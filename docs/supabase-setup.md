# Supabase Setup (backend MVP)

This is the first backend layer for Global Market KG: **order capture + soft
customer base**. The storefront stays static (catalog, product pages, SEO,
banners, photos). WhatsApp ordering is unchanged. See
[`backend-mvp-plan.md`](backend-mvp-plan.md) for the full plan.

This document describes how to apply the schema. No keys or secrets live in git.

For the full go-live sequence (project → migration → Cloudflare env → preview
deploy → endpoint smoke test → checkout wiring) see
[`backend-go-live-checklist.md`](backend-go-live-checklist.md). Track each step
in [`backend-go-live-worksheet.md`](backend-go-live-worksheet.md) (yes/no, no
secret values). Verify env/config shape without revealing values:
`python3 scripts/check_backend_env_shape.py`.

## What lives in the repo

```text
supabase/
  .gitignore                         # blocks .env / local CLI state
  migrations/
    0001_init_orders_customers.sql   # MVP tables + indexes + RLS
docs/supabase-setup.md               # this file
```

The migration creates five tables — `customers`, `orders`, `order_items`,
`marketing_attribution`, `customer_consents` — plus indexes, `updated_at`
triggers, and Row Level Security.

## What to create in Supabase

1. Create a Supabase project (region close to Kyrgyzstan, e.g. EU).
2. Apply the migration. Either:
   - **SQL editor:** paste the contents of
     `supabase/migrations/0001_init_orders_customers.sql` and run it; or
   - **Supabase CLI** (recommended, keeps migrations tracked):
     ```bash
     supabase link --project-ref <your-project-ref>
     supabase db push
     ```
3. Verify in Table Editor that the five tables exist and that RLS is **enabled**
   on each (it is, by the migration).

## Keys — what must stay out of git

The migration adds no keys. When integration starts, store keys only in a local,
git-ignored `.env` (the `supabase/.gitignore` already blocks `.env`):

| Key | Where it may be used | Never |
|---|---|---|
| `anon` (public) | browser / frontend (only if RLS is correct) | — |
| `service_role` | server / edge function ONLY | never sent to the browser, never committed |

Rules:

- Do not commit `.env`, `service_role`, or any Supabase key.
- The browser may only ever receive the `anon` key.
- `service_role` bypasses RLS — keep it server-side only.

## Access model (RLS)

RLS is enabled on all five tables with **no anonymous policies**, so the public
`anon` key cannot read or write them directly.

- **Public order creation (later):** done by a trusted server/edge layer using
  the `service_role` key, with input validation. Do **not** add an anon insert
  policy that lets the browser write arbitrary rows.
- **Admin / manager:** authenticated users whose JWT `app_metadata.is_admin` is
  `true` can read all tables and update orders/customers (status, manager
  comment). Set the flag via the Supabase Auth admin API:
  ```text
  app_metadata: { "is_admin": true }
  ```
  Helper: `public.is_admin()` reads that claim. `public.set_updated_at()` keeps
  `updated_at` fresh on `customers` and `orders`.

## Next frontend integration step (not done yet)

This task is schema-only. The next steps, in order:

1. Add a trusted `POST /api/orders` (server/edge) that inserts `orders` +
   `order_items` (+ optional `marketing_attribution`, `customer_consents`) using
   the `service_role` key, validating input and computing totals server-side.
2. On checkout: call that endpoint, then **open WhatsApp as today**. If the API
   is unavailable, fall back to the current WhatsApp-only flow (no data loss for
   the customer).
3. Build a simple admin orders page (list, order card, status change, manager
   comment, search by phone/name, source view) gated by `is_admin()`.

Until those steps land, the live site behaviour is unchanged.
