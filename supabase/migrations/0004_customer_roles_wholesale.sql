-- Global Market KG — customer roles + wholesale applications
--
-- Unifies "registration" with the SMS-login flow already built in
-- functions/api/auth/verify-otp.js: a public.customers row is created (or
-- reused) the first time a phone completes SMS login. There is still no
-- password/account — the phone + SMS code IS the identity, same as before.
--
-- Role model (derived, not stored as one column):
--   retail            no customers row yet (guest, never logged in)
--   registered         customers row exists, customer_type = 'retail'
--   wholesale_pending  customers row exists, wholesale_status = 'pending'
--   wholesale          customers row exists, customer_type = 'wholesale'
--   admin / manager    staff — unrelated to this table, already handled by
--                       Supabase Auth app_metadata.is_admin (see 0001)
--
-- Access model unchanged from 0001-0003: RLS enabled, zero anon policies.
-- Only the service role (server-side, in Cloudflare Functions) and
-- authenticated admins (is_admin()) can read/write.

begin;

-- ---------------------------------------------------------------------------
-- customers: a stable, digits-only phone key so a Cloudflare Function can
-- upsert-by-phone without racing on formatting differences ("+996 700 123456"
-- vs "0700123456"), same pattern as orders.customer_phone_digits in 0002.
-- ---------------------------------------------------------------------------
alter table public.customers
  add column if not exists phone_digits text
  generated always as (regexp_replace(coalesce(phone, ''), '\D', '', 'g')) stored;

-- Partial unique index: only enforce uniqueness where a phone actually exists,
-- so historical/manual rows with a blank phone don't collide with each other.
create unique index if not exists customers_phone_digits_uidx
  on public.customers (phone_digits)
  where phone_digits <> '';

alter table public.customers
  add column if not exists wholesale_status text not null default 'none';

alter table public.customers
  drop constraint if exists customers_wholesale_status_check;
alter table public.customers
  add constraint customers_wholesale_status_check
  check (wholesale_status in ('none', 'pending', 'approved', 'rejected'));

alter table public.customers
  drop constraint if exists customers_customer_type_check;
alter table public.customers
  add constraint customers_customer_type_check
  check (customer_type in ('retail', 'wholesale', 'manager_created'));

-- ---------------------------------------------------------------------------
-- wholesale_applications — "Подать заявку на оптовый доступ"
-- ---------------------------------------------------------------------------
create table if not exists public.wholesale_applications (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  customer_id  uuid references public.customers (id) on delete set null,
  name         text,
  phone        text,
  phone_digits text generated always as (regexp_replace(coalesce(phone, ''), '\D', '', 'g')) stored,
  shop_name    text,
  city         text,
  comment      text,
  status       text not null default 'pending'
                 check (status in ('pending', 'approved', 'rejected')),
  reviewed_by  text,
  reviewed_at  timestamptz
);

create index if not exists wholesale_applications_customer_id_idx
  on public.wholesale_applications (customer_id);
create index if not exists wholesale_applications_status_idx
  on public.wholesale_applications (status);
create index if not exists wholesale_applications_phone_digits_idx
  on public.wholesale_applications (phone_digits);

drop trigger if exists wholesale_applications_set_updated_at on public.wholesale_applications;
create trigger wholesale_applications_set_updated_at
  before update on public.wholesale_applications
  for each row execute function public.set_updated_at();

alter table public.wholesale_applications enable row level security;

create policy wholesale_applications_admin_select on public.wholesale_applications
  for select to authenticated using (public.is_admin());
create policy wholesale_applications_admin_update on public.wholesale_applications
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

commit;
