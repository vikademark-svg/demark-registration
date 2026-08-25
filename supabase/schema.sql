-- ====================================================================
-- DeMark — схема бази даних для сторінки реєстрації відвідувачів
-- Виконати повністю у Supabase → SQL Editor (проєкт → SQL Editor → New query)
-- ====================================================================

create extension if not exists "pgcrypto";

create table if not exists public.registrations (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),

  full_name        text not null,
  phone            text not null,

  city             text not null,
  store_id         text not null,
  store_name       text not null,

  latitude         double precision,
  longitude        double precision,
  geo_accuracy_m   double precision,          -- точність геолокації пристрою (navigator.geolocation)
  distance_to_store_m double precision,       -- відстань до обраного магазину на момент реєстрації
  store_confirmed_manually boolean not null default false, -- true, якщо користувач сам обрав магазин (не автоматично)

  age_range        text not null check (age_range in ('16-24','25-35','36-45','46-55','56+')),
  gender           text not null check (gender in ('male','female','not_specified')),

  user_agent       text,

  -- Нормалізований номер телефону: залишає лише цифри та бере останні 9
  -- (стандартна довжина українського мобільного без коду країни), щоб
  -- "+380501234567", "380501234567", "0501234567" й "050-123-45-67"
  -- вважались одним і тим самим номером незалежно від формату вводу.
  phone_normalized text generated always as (
    right(regexp_replace(phone, '\D', '', 'g'), 9)
  ) stored,

  -- Непередбачуваний "капабіліті-токен" для міні-застосунку (/app):
  -- генерується в браузері (crypto.randomUUID()) під час реєстрації,
  -- зберігається на пристрої відвідувача (localStorage) і дає доступ лише
  -- до ЙОГО Ж запису через серверний API-роут (service role), без окремого
  -- логіну/пароля. anon НЕ має SELECT на цю таблицю, тож знаючи лише токен
  -- прочитати чужий рядок неможливо.
  access_token     uuid not null default gen_random_uuid()
);

-- Знижка одноразова на людину: другий insert з тим самим номером телефону
-- впаде з помилкою unique_violation (код 23505) — саме на цей код орієнтується
-- app/register/page.tsx, щоб показати "знижку вже використано" замість
-- надання її вдруге. Тому у формі так важливо отримати реальний номер
-- (через Contact Picker), а не довільний ввід.
create unique index if not exists registrations_phone_normalized_unique_idx
  on public.registrations (phone_normalized);

create unique index if not exists registrations_access_token_unique_idx
  on public.registrations (access_token);

create index if not exists registrations_created_at_idx on public.registrations (created_at desc);
create index if not exists registrations_city_idx on public.registrations (city);
create index if not exists registrations_store_idx on public.registrations (store_id);
create index if not exists registrations_age_idx on public.registrations (age_range);
create index if not exists registrations_gender_idx on public.registrations (gender);
create index if not exists registrations_search_idx on public.registrations using gin (
  to_tsvector('simple', coalesce(full_name, '') || ' ' || coalesce(phone, ''))
);

alter table public.registrations enable row level security;

-- Будь-хто (анонімний відвідувач сайту) може ДОДАВАТИ новий запис реєстрації.
drop policy if exists "public can insert registrations" on public.registrations;
create policy "public can insert registrations"
  on public.registrations
  for insert
  to anon
  with check (true);

-- Переглядати/шукати записи може лише автентифікований адміністратор
-- (обліковий запис, створений вручну в Supabase Auth → Authentication → Users).
drop policy if exists "authenticated can read registrations" on public.registrations;
create policy "authenticated can read registrations"
  on public.registrations
  for select
  to authenticated
  using (true);

-- Анонімним користувачам заборонено читати чи змінювати чужі дані.
-- (insert-only policy вище — єдина дія, дозволена ролі anon)

-- RLS-політики керують тим, ЯКІ рядки видно/доступні, але Postgres окремо
-- вимагає базовий GRANT на рівні таблиці для самої дії. Без цих GRANT
-- запити від anon/authenticated будуть падати з "permission denied for
-- table registrations" ще до того, як спрацюють політики вище.
grant insert on public.registrations to anon;
grant select on public.registrations to authenticated;

-- ====================================================================
-- Push-підписки (Web Push) — прив'язані до конкретної реєстрації.
-- Створюються з міні-застосунку /app, коли відвідувач вмикає сповіщення.
-- ====================================================================

create table if not exists public.push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  registration_id  uuid not null references public.registrations(id) on delete cascade,
  endpoint         text not null,
  p256dh           text not null,
  auth             text not null,
  user_agent       text
);

create unique index if not exists push_subscriptions_endpoint_unique_idx
  on public.push_subscriptions (endpoint);
create index if not exists push_subscriptions_registration_idx
  on public.push_subscriptions (registration_id);

alter table public.push_subscriptions enable row level security;

-- anon може лише створити/оновити СВОЮ підписку (endpoint унікальний per
-- пристрій+браузер) — не може читати чужі endpoint'и чи реєстрації.
drop policy if exists "public can insert push subscriptions" on public.push_subscriptions;
create policy "public can insert push subscriptions"
  on public.push_subscriptions
  for insert
  to anon
  with check (true);

drop policy if exists "public can update push subscriptions" on public.push_subscriptions;
create policy "public can update push subscriptions"
  on public.push_subscriptions
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists "authenticated can read push subscriptions" on public.push_subscriptions;
create policy "authenticated can read push subscriptions"
  on public.push_subscriptions
  for select
  to authenticated
  using (true);

grant insert, update on public.push_subscriptions to anon;
grant select on public.push_subscriptions to authenticated;

-- ====================================================================
-- Розсилки (push-кампанії), які створює й надсилає адмін з /admin.
-- Фактичну доставку через Web Push виконує серверний роут
-- app/api/admin/send-notification (service role, VAPID-ключі) — не anon-ключ.
-- ====================================================================

create table if not exists public.notifications (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  title            text not null,
  body             text not null,
  url              text,

  -- Фільтри аудиторії: null у полі = "будь-яке значення" (без фільтра).
  filter_city      text,
  filter_store_id  text,
  filter_age_range text,
  filter_gender    text,

  sent_count       integer not null default 0
);

create index if not exists notifications_created_at_idx on public.notifications (created_at desc);

alter table public.notifications enable row level security;

-- Лише автентифікований адмін бачить і створює розсилки. anon не має жодного
-- доступу — стрічку "своїх" розсилок відвідувач отримує через серверний
-- роут /api/me (service role, фільтрує на сервері), а не прямим запитом.
drop policy if exists "authenticated can manage notifications" on public.notifications;
create policy "authenticated can manage notifications"
  on public.notifications
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update on public.notifications to authenticated;

-- ====================================================================
-- Створення адміністратора:
-- Supabase Dashboard → Authentication → Users → Add user
-- Вкажіть email та пароль співробітника, який матиме доступ до /admin.
-- Жодних додаткових SQL-кроків для цього не потрібно.
-- ====================================================================
