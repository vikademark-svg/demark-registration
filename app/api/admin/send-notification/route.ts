import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { webpush } from "@/lib/webpush";

export const dynamic = "force-dynamic";

type Filters = {
  city?: string;
  storeId?: string;
  ageRange?: string;
  gender?: string;
};

/**
 * POST /api/admin/send-notification
 * headers: Authorization: Bearer <supabase access token адміна>
 * body: { title: string; body: string; url?: string; filters?: Filters }
 *
 * Тільки для автентифікованих адмінів (перевіряємо JWT із сесії /admin).
 * Створює запис у notifications і реально надсилає Web Push усім
 * підписникам, чия реєстрація підпадає під фільтри аудиторії.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: { title?: string; body?: string; url?: string; filters?: Filters };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { title, body, url, filters = {} } = payload;
  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "title and body are required" }, { status: 400 });
  }

  const { data: notification, error: insertError } = await supabaseAdmin
    .from("notifications")
    .insert({
      title: title.trim(),
      body: body.trim(),
      url: url?.trim() || null,
      filter_city: filters.city || null,
      filter_store_id: filters.storeId || null,
      filter_age_range: filters.ageRange || null,
      filter_gender: filters.gender || null,
    })
    .select("id")
    .single();

  if (insertError || !notification) {
    return NextResponse.json({ error: "could not create notification" }, { status: 500 });
  }

  let query = supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, registrations!inner(city, store_id, age_range, gender)");

  if (filters.city) query = query.eq("registrations.city", filters.city);
  if (filters.storeId) query = query.eq("registrations.store_id", filters.storeId);
  if (filters.ageRange) query = query.eq("registrations.age_range", filters.ageRange);
  if (filters.gender) query = query.eq("registrations.gender", filters.gender);

  const { data: subscriptions, error: subsError } = await query;

  if (subsError) {
    return NextResponse.json(
      { error: "could not load subscriptions", notificationId: notification.id },
      { status: 500 }
    );
  }

  const payloadJson = JSON.stringify({
    title: title.trim(),
    body: body.trim(),
    url: url?.trim() || null,
    notificationId: notification.id,
  });

  let sent = 0;
  let failed = 0;
  const deadSubscriptionIds: string[] = [];

  for (const sub of subscriptions ?? []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payloadJson
      );
      sent++;
    } catch (err: any) {
      failed++;
      // 404/410 = підписка більше не дійсна (браузер відписався/дані стерто) — прибираємо її
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        deadSubscriptionIds.push(sub.id);
      }
    }
  }

  if (deadSubscriptionIds.length > 0) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", deadSubscriptionIds);
  }

  await supabaseAdmin.from("notifications").update({ sent_count: sent }).eq("id", notification.id);

  return NextResponse.json({
    notificationId: notification.id,
    matched: subscriptions?.length ?? 0,
    sent,
    failed,
  });
}
