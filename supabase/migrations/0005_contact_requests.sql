-- Global Market KG — contact form inbox
begin;

create table if not exists public.contact_requests (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  name         text not null,
  phone        text not null,
  phone_digits text generated always as (regexp_replace(coalesce(phone, ''), '\D', '', 'g')) stored,
  email        text,
  message      text not null,
  status       text not null default 'new' check (status in ('new', 'in_progress', 'closed'))
);

create index if not exists contact_requests_created_at_idx on public.contact_requests (created_at desc);
create index if not exists contact_requests_status_idx on public.contact_requests (status);
create index if not exists contact_requests_phone_digits_idx on public.contact_requests (phone_digits);

alter table public.contact_requests enable row level security;
create policy contact_requests_admin_select on public.contact_requests
  for select to authenticated using (public.is_admin());
create policy contact_requests_admin_update on public.contact_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

commit;
