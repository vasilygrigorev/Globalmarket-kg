# Claude Next Task

> **STATUS: DONE (2026-07-03).** This task (release-readiness sweep) is
> complete — 4 commits, full suite 240/240. See
> `/Users/macmini/.codex/shared-state/handoff.md` (top entry) for the exact
> commits and what changed. Codex: replace this file's body with the next
> task when ready.

Use this file as the next large handoff prompt for Claude Code.

## Context

Project:

```text
/Users/macmini/Documents/Codex/2026-05-28-new-chat-2
```

Branch:

```text
collab/preview-baseline
```

Latest verified commits:

- `569e747 Add Petya photo import guardrails`
- `c4e3a27 Remove 273 unused raw Telegram/contact-sheet product photo leftovers`
- `d38e7a1 Refresh production-readiness baseline for the go-live handoff`

Codex verification after `d38e7a1`:

- `python3 scripts/verify_backend_mvp.py` OK.
- `python3 scripts/check_no_secrets.py` clean.
- `git diff --check` clean.
- `python3 scripts/report_photo_coverage.py --json`:
  - total products: 460
  - products with photos: 92
  - photo coverage: 20.0%
  - perfume: 22/22 with photos
  - non-perfume complete galleries: 70
  - unused raw Telegram leftovers: 0

Known harmless dirty files after verification:

- `docs/project-stage-map.md` generated timestamp-only stage report change.
- `sitemap.xml` generated date-only `lastmod` refresh.

Do not commit those two files unless your task intentionally changes them.

## Expanded Authority

Claude may now work more autonomously on local code quality and release-readiness.

Allowed:

- make coherent local commits without waiting for Codex after each small change;
- make several related commits in one session if each commit is clean and named clearly;
- edit storefront, admin, docs, tests, scripts, generators, and static packaging when the task requires it;
- add contract tests and verification steps;
- run all local checks repeatedly;
- create or update local reports under `outputs/`;
- update this handoff file when finished;
- update shared handoff notes if useful.

Still not allowed:

- no GitHub push;
- no Cloudflare production deploy;
- no preview deploy unless the user explicitly asks;
- no Supabase/Cloudflare setting changes;
- no secrets, tokens, env values, or `admin/config.js` commits;
- no destructive deletion of user source photos outside already verified unused generated leftovers;
- no SQL migration against live Supabase;
- no billing/domain/DNS changes;
- no large architecture rewrite.

If a task needs one of those blocked actions, stop and write the exact next action for Codex/user.

## Read First

Read:

- `AGENTS.md`
- `/Users/macmini/.codex/shared-state/COLLAB-PROTOCOL.md`
- `/Users/macmini/.codex/shared-state/handoff.md`
- `/Users/macmini/.codex/shared-state/tasks.md`
- `/Users/macmini/.codex/memories/cross-chat-memory/current-focus.md`
- `docs/production-readiness.md`
- `docs/test-coverage.md`
- `docs/product-photo-rules.md`
- `docs/api-orders.md`
- `docs/backend-go-live-checklist.md`
- `docs/catalog-taxonomy.md`
- `data/site-config.json`
- `data/public-catalog.json`
- `scripts/verify_backend_mvp.py`

Start with:

```bash
git status --short --branch
git log --oneline -8
```

If there are unexpected dirty files beyond `docs/project-stage-map.md` and `sitemap.xml`, inspect them before editing.

## Main Task — Release-Readiness Sweep For Storefront + Admin + Petya

Make a broad but safe local pass that prepares the current branch for the next preview/production decision.

### Part A — Admin Acceptance Guardrails

Goal: make sure the admin can really be used by the owner/manager without silently breaking.

Add or harden tests/docs for:

- orders list loads with backend API enabled;
- empty/error/loading states are visible and understandable;
- filters work together without losing order count;
- copy phone / copy address / call link behavior remains covered;
- keyboard access for core admin controls remains covered;
- admin must not expose service-role keys or raw config secrets;
- admin package includes only intended admin files.

Prefer contract tests over fragile browser UI tests unless a browser check is clearly worth it.

### Part B — Checkout + Orders API Contract

Goal: keep WhatsApp flow working while backend orders are introduced.

Add or harden tests/docs for:

- checkout still works without registration;
- checkout still falls back to WhatsApp if backend API is unavailable;
- UTM/source fields keep flowing into order payload/message;
- order payload shape matches `docs/api-orders.md`;
- no duplicate order submission on quick repeated clicks, if current code already has a guard or can get one safely;
- backend API flag state is documented clearly.

Do not remove WhatsApp fallback.

### Part C — Storefront Release Polish Without Redesign

Goal: reduce obvious regressions before preview.

Check and minimally improve, only if low-risk:

- header/menu/footer are shared through `data/site-config.json` and generated pages use the shared blocks;
- mobile category tiles and menu section names stay in sync;
- product pages have valid canonical/OG/Product JSON-LD;
- product pages have working back/home/catalog paths;
- related products do not show broken image paths;
- sitemap/catalog/product pages remain internally consistent.

Do not start a visual redesign. Add guardrails and small fixes only.

### Part D — Photo/1C/Petya Continuity

Goal: make future Petya photo and 1C batches easier to continue.

Update docs/tests/scripts only where useful:

- document the perfume card-only rule and normal product card/front/back rule;
- document that 1C parentheses often mean weight/volume/wash count, e.g. `Dalli (100)` means 100 washes;
- ensure photo coverage report remains useful after new batches;
- ensure no raw Telegram/contact/OCR images enter public gallery paths.

### Part E — Production-Readiness Status

Update one concise document, preferably `docs/production-readiness.md` or `docs/backend-go-live-checklist.md`, with:

- what is ready locally;
- what still needs Codex/user-only action;
- exact next gated steps before production:
  - commit if needed;
  - preview deploy;
  - live admin smoke;
  - live checkout/order smoke;
  - user approval;
  - production deploy/push.

Do not claim production is ready unless live checks have actually happened.

## Verification

Before finishing, run:

```bash
node --check app.js
node --check admin/admin.js
node --check admin/admin.logic.js
python3 scripts/verify_product_galleries.py
python3 scripts/report_photo_coverage.py --json
python3 scripts/verify_backend_mvp.py
python3 scripts/check_no_secrets.py
git diff --check
git status --short --branch
```

If you add a new test, wire it into `scripts/verify_backend_mvp.py`.

## Commit Rules

You may make local commits.

Rules:

- commit only coherent, verified changes;
- do not commit `docs/project-stage-map.md` or `sitemap.xml` unless intentionally changed;
- do not commit secrets or env/config files;
- write short factual commit messages.

Suggested commit themes:

```bash
git commit -m "Add admin and checkout release-readiness guardrails"
git commit -m "Harden storefront SEO and shared-block consistency checks"
git commit -m "Update production readiness handoff"
```

Use only the messages that match actual work.

## Handoff Back To Codex

When finished, report:

- commits made;
- files changed;
- checks run;
- any dirty files left intentionally;
- what is now safer than before;
- what remains Codex/user-only;
- whether the next task is Claude-safe.
