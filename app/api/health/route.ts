import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Тимчасовий діагностичний роут: показує лише ЧИ встановлені критичні
 * env-змінні (не самі значення) — щоб перевірити, чи Vercel реально
 * прокинув їх у рантайм функції. Видалити після діагностики.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  let host = "";
  try {
    host = url ? new URL(url).host : "";
  } catch {
    host = "invalid-url";
  }

  return NextResponse.json({
    hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseUrlHost: host,
    supabaseUrlLength: url.length,
    hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    anonKeyLength: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").length,
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    serviceRoleKeyLength: (process.env.SUPABASE_SERVICE_ROLE_KEY || "").length,
    hasVapidPublic: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    hasVapidPrivate: Boolean(process.env.VAPID_PRIVATE_KEY),
  });
}
