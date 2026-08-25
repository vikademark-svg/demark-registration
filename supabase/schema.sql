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

  user_agent       text
);

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
-- Створення адміністратора:
-- Supabase Dashboard → Authentication → Users → Add user
-- Вкажіть email та пароль співробітника, який матиме доступ до /admin.
-- Жодних додаткових SQL-кроків для цього не потрібно.
-- ====================================================================
