import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Не кидаємо помилку на рівні модуля під час білду (createClient() з порожнім
  // URL валить увесь `next build`, включно зі сторінками, які взагалі не
  // звертаються до Supabase) — лише попереджаємо в консолі та підставляємо
  // заглушку, щоб клієнт міг ініціалізуватись.
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase env vars відсутні: перевірте NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
