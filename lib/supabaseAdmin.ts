import { createClient } from "@supabase/supabase-js";

/**
 * Сервісний Supabase-клієнт — ТІЛЬКИ для серверного коду (app/api/**\/route.ts).
 * Використовує service role key, який обходить RLS повністю, тому ніколи не
 * повинен імпортуватись у клієнтські компоненти чи потрапляти в браузер.
 * На відміну від lib/supabaseClient.ts (анонімний, публічний, безпечний
 * у браузері завдяки RLS), цей файл — довірена серверна межа доступу.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "SUPABASE_SERVICE_ROLE_KEY відсутній: серверні API-роути (/api/me, /api/subscribe, /api/admin/*) не працюватимуть."
  );
}

export const supabaseAdmin = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  serviceRoleKey || "placeholder-service-role-key",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
