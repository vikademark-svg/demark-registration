import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * POST /api/subscribe
 * body: { token: string; subscription: PushSubscriptionJSON; userAgent?: string }
 *
 * Прив'язує Web Push підписку браузера до конкретної реєстрації (за
 * access_token із localStorage) і зберігає її в push_subscriptions —
 * звідти адмінка бере адресатів для розсилок (app/api/admin/send-notification).
 */
export async function POST(request: NextRequest) {
  let payload: {
    token?: string;
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    userAgent?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { token, subscription, userAgent } = payload;
  if (!token || !subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ error: "token and subscription are required" }, { status: 400 });
  }

  const { data: registration, error: regError } = await supabaseAdmin
    .from("registrations")
    .select("id")
    .eq("access_token", token)
    .maybeSingle();

  if (regError || !registration) {
    return NextResponse.json({ error: "unknown token" }, { status: 404 });
  }

  const { error: upsertError } = await supabaseAdmin.from("push_subscriptions").upsert(
    {
      registration_id: registration.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent ?? null,
    },
    { onConflict: "endpoint" }
  );

  if (upsertError) {
    return NextResponse.json({ error: "could not save subscription" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
