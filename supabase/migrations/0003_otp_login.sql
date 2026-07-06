-- Global Market KG — SMS OTP login ("Мои заказы", persistent session)
--
-- Adds an ephemeral token->phone binding table for the phone+SMS-OTP login
-- flow (functions/api/auth/request-otp.js, functions/api/auth/verify-otp.js).
--
-- Why this table exists: the SMS PRO (smspro.nikita.kg) OTP API returns an
-- opaque `token` from /otp/send and only checks token+code at /otp/verify —
-- it never tells us which phone a token belongs to. Without recording that
-- binding ourselves, a client could request an OTP for their own phone,
-- receive the real code, then call verify-otp claiming a *different* phone
-- number and get a session cookie for someone else's orders. This table is
-- the source of truth verify-otp uses instead of trusting a client-supplied
-- phone.
--
-- Access model: same posture as 0001/0002 — RLS enabled, zero anon
-- policies. Only the service role (server-side, in
-- functions/api/auth/*.js) reads/writes this table.

begin;

create table if not exists public.otp_requests (
  token text primary key,
  phone_digits text not null,
  created_at timestamptz not null default now()
);

create index if not exists otp_requests_created_at_idx on public.otp_requests (created_at);

alter table public.otp_requests enable row level security;

commit;
