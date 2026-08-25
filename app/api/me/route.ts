import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * GET /api/me?token=<access_token>
 *
 * Повертає дані ОДНІЄЇ реєстрації (за непередбачуваним токеном з localStorage
 * пристрою) та стрічку розсилок, що підходять під профіль цієї людини.
 * Працює через service role (обходить RLS) — це єдиний безпечний спосіб
 * дати відвідувачу читати "своє" без окремого логіну/пароля: без токена
 * знайти конкретний рядок неможливо (anon не має SELECT на registrations).
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const { data: registration, error: regError } = await supabaseAdmin
    .from("registrations")
    .select("full_name, phone, city, store_id, store_name, age_range, gender, created_at")
    .eq("access_token", token)
    .maybeSingle();

  if (regError) {
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
  if (!registration) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { data: allNotifications, error: notifError } = await supabaseAdmin
    .from("notifications")
    .select("id, title, body, url, created_at, filter_city, filter_store_id, filter_age_range, filter_gender")
    .order("created_at", { ascending: false });

  const notifications = (notifError ? [] : allNotifications ?? [])
    .filter((n) => {
      if (n.filter_city && n.filter_city !== registration.city) return false;
      if (n.filter_store_id && n.filter_store_id !== registration.store_id) return false;
      if (n.filter_age_range && n.filter_age_range !== registration.age_range) return false;
      if (n.filter_gender && n.filter_gender !== registration.gender) return false;
      return true;
    })
    .map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      url: n.url,
      createdAt: n.created_at,
    }));

  return NextResponse.json({
    profile: {
      fullName: registration.full_name,
      phone: registration.phone,
      city: registration.city,
      storeName: registration.store_name,
      ageRange: registration.age_range,
      gender: registration.gender,
      createdAt: registration.created_at,
    },
    notifications,
    // Тимчасово, для діагностики — прибрати після виправлення.
    debug: {
      registrationCity: registration.city,
      registrationStoreId: registration.store_id,
      registrationAgeRange: registration.age_range,
      registrationGender: registration.gender,
      totalNotifications: allNotifications?.length ?? 0,
      notifErrorMessage: notifError?.message ?? null,
      rawNotifications: allNotifications ?? [],
    },
  });
}
