-- Global Market KG — backend MVP schema (initial migration)
--
-- Scope: order capture + soft customer base + marketing attribution + consents.
-- The static storefront (catalog, product pages, SEO, banners) stays file-based.
-- This migration ONLY defines tables, indexes, and RLS. No data, no secrets.
--
-- Access model (see docs/supabase-setup.md):
--   * RLS is enabled on every table with NO anonymous policies => the public
--     anon key cannot read or write these tables directly.
--   * Order inserts will be performed later by a trusted server/edge layer
--     using the service role key (service role bypasses RLS). The anon/browser
--     client must never receive the service role key.
--   * Admin/manager read & manage access is granted to authenticated users
--     flagged with app_metadata.is_admin = true (see public.is_admin()).
--   * WhatsApp ordering is unchanged; the site keeps opening WhatsApp.

begin;

-- gen_random_uuid() is provided by pgcrypto (preinstalled on Supabase).
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin check: an authenticated user is an admin/manager when their JWT
-- app_metadata carries is_admin = true. Set this via Supabase Auth admin API,
-- never from the browser. Service role bypasses RLS entirely.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata' ->> 'is_admin')::boolean,
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- customers — soft customer card (no mandatory registration yet)
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id                       uuid primary key default gen_random_uuid(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  name                     text,
  phone                    text,
  whatsapp                 text,
  city                     text,
  region                   text,
  address                  text,
  customer_type            text not null default 'retail',
  default_discount_percent numeric not null default 3,
  notes                    text
);

create index if not exists customers_phone_idx on public.customers (phone);
create index if not exists customers_whatsapp_idx on public.customers (whatsapp);

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- orders — order header (snapshot of contact + totals)
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  customer_id      uuid references public.customers (id) on delete set null,
  status           text not null default 'new'
                     check (status in ('new','contacted','confirmed','completed','cancelled')),
  total_kgs        numeric not null default 0,
  customer_name    text,
  customer_phone   text,
  city             text,
  region           text,
  address          text,
  customer_comment text,
  manager_comment  text,
  customer_source  text,
  promo_code       text,
  whatsapp_message text,
  sent_to_whatsapp boolean not null default false
);

create index if not exists orders_customer_id_idx on public.orders (customer_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_customer_phone_idx on public.orders (customer_phone);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- order_items — line items with price/title snapshot at order time
-- ---------------------------------------------------------------------------
create table if not exists public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete cascade,
  product_id      text,
  product_slug    text,
  title_snapshot  text,
  brand_snapshot  text,
  unit_snapshot   text,
  qty             integer not null default 1 check (qty > 0),
  price_kgs       numeric not null default 0,
  line_total_kgs  numeric not null default 0,
  image_snapshot  text
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_product_id_idx on public.order_items (product_id);

-- ---------------------------------------------------------------------------
-- marketing_attribution — ad source of an order (never derived from phone)
-- ---------------------------------------------------------------------------
create table if not exists public.marketing_attribution (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid references public.orders (id) on delete cascade,
  customer_id   uuid references public.customers (id) on delete set null,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  utm_term      text,
  referrer      text,
  first_seen_at timestamptz,
  last_seen_at  timestamptz,
  manual_source text,
  promo_code    text
);

create index if not exists marketing_attribution_order_id_idx on public.marketing_attribution (order_id);
create index if not exists marketing_attribution_customer_id_idx on public.marketing_attribution (customer_id);

-- ---------------------------------------------------------------------------
-- customer_consents — feedback/marketing consent (optional, not required to order)
-- ---------------------------------------------------------------------------
create table if not exists public.customer_consents (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  customer_id  uuid references public.customers (id) on delete set null,
  order_id     uuid references public.orders (id) on delete cascade,
  consent_type text,
  is_granted   boolean not null default false,
  source       text,
  text_version text
);

create index if not exists customer_consents_customer_id_idx on public.customer_consents (customer_id);
create index if not exists customer_consents_order_id_idx on public.customer_consents (order_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Enable RLS everywhere. With no anon policy, the public anon key has no access.
-- Admins (app_metadata.is_admin = true) can read and manage. Service role
-- (server/edge) bypasses RLS for safe order inserts.
-- ---------------------------------------------------------------------------
alter table public.customers             enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.marketing_attribution enable row level security;
alter table public.customer_consents     enable row level security;

-- Admin read access
create policy customers_admin_select on public.customers
  for select to authenticated using (public.is_admin());
create policy orders_admin_select on public.orders
  for select to authenticated using (public.is_admin());
create policy order_items_admin_select on public.order_items
  for select to authenticated using (public.is_admin());
create policy marketing_attribution_admin_select on public.marketing_attribution
  for select to authenticated using (public.is_admin());
create policy customer_consents_admin_select on public.customer_consents
  for select to authenticated using (public.is_admin());

-- Admin manage access (orders + customers): status changes, manager comments.
create policy orders_admin_update on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy customers_admin_update on public.customers
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- NOTE: intentionally NO insert/select policies for the anon role.
-- Public order creation will be added later through a trusted server/edge
-- function using the service role key, with input validation. Do not add an
-- anon insert policy that would let the browser write arbitrary rows.

commit;
