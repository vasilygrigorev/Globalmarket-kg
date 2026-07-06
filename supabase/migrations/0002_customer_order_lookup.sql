-- Global Market KG — customer order lookup ("Мои заказы")
--
-- Adds what's needed for a customer to look up their own order history
-- without any account/login: a short lookup_code generated client-side at
-- checkout (delivered to the customer for free — it rides along inside the
-- WhatsApp message they already send to the manager), plus a digits-only
-- phone column so lookups match regardless of how the phone was formatted
-- ("+996 700 123456", "0700123456", etc.).
--
-- Access model UNCHANGED from 0001: RLS still has NO anon policies on
-- orders/order_items. The new functions/api/customer-orders.js endpoint
-- reads via the service role key (server-side only), exactly like order
-- inserts already do — this migration does not open any new anon access.

begin;

alter table public.orders
  add column if not exists lookup_code text;

-- Generated column: Postgres computes/stores this automatically from
-- customer_phone on insert/update, so the API never sends it explicitly
-- (a GENERATED ALWAYS column rejects an explicit value on INSERT).
alter table public.orders
  add column if not exists customer_phone_digits text
  generated always as (regexp_replace(coalesce(customer_phone, ''), '\D', '', 'g')) stored;

create index if not exists orders_customer_phone_digits_idx on public.orders (customer_phone_digits);
create index if not exists orders_lookup_code_idx on public.orders (lookup_code);

commit;
