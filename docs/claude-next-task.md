# Claude Next Task

Use this file as the next large handoff prompt for Claude Code.

## Context

Project:

```text
/Users/macmini/Documents/Codex/2026-05-28-new-chat-2
```

Current branch:

```text
collab/preview-baseline
```

Latest local checkpoints before this handoff:

- `0ed6728 Add admin manager workflow guardrails`
- `aa38f8d Add admin order-summary copy and manager workflow docs`
- `51ff1ef Add admin call link and reset-filters usability`
- `8c4c5ee Add admin order item summary helper`

Current state:

- Backend/Supabase/Admin MVP groundwork exists.
- Checkout can save orders through `/api/orders` when enabled and still falls back to WhatsApp.
- Admin has manager workflow basics: copy summary, call link, reset filters, status/comment guardrails, item count summary.
- Current photo coverage baseline: 97 / 441 products = 22.0%.
- Latest full verifier result from Codex after `8c4c5ee`: `Backend/admin MVP verification OK`; package OK; secret scans clean.
- Do not push or deploy production unless the user explicitly asks.

Known harmless dirty files after a full verification run:

- `docs/project-stage-map.md` may contain a generated timestamp/report refresh.
- `sitemap.xml` may contain generated `lastmod` refresh.

Do not commit those two unless the task explicitly needs them.

## Read First

Before editing, read:

- `AGENTS.md`
- `docs/test-coverage.md`
- `docs/admin-orders-spec.md`
- `docs/api-orders.md`
- `docs/backend-go-live-checklist.md`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.logic.js`
- `tests/admin.logic.test.mjs`
- `tests/admin.dom.test.mjs`
- `tests/admin-workflow.test.mjs`
- `/Users/macmini/.codex/shared-state/COLLAB-PROTOCOL.md`
- `/Users/macmini/.codex/shared-state/handoff.md`
- `/Users/macmini/.codex/shared-state/tasks.md`
- `/Users/macmini/.codex/shared-state/decisions.md`
- `/Users/macmini/.codex/memories/cross-chat-memory/current-focus.md`

Then run:

```bash
git status --short --branch
git branch --show-current
```

If there are unrelated or conflicting changes beyond generated-only `docs/project-stage-map.md` / `sitemap.xml`, stop and report them.

## Main Task — Admin Mobile And Daily-Use Readiness Guardrails

Make one larger local-only pass that improves confidence that the manager can use `/admin/` from a phone or small laptop.

Focus on low-risk usability and testable contracts. Do not redesign broadly.

Work in this order:

1. Inspect current admin layout/CSS and fixture tests:
   - mobile width behavior;
   - order table/card readability;
   - action buttons in order detail;
   - error/loading/empty states;
   - copy/call/status/comment controls.
2. Add 2-4 small, practical improvements only if they are safe.
3. Add no-network tests for the new behavior and wire them into `scripts/verify_backend_mvp.py`.
4. Update `docs/admin-orders-spec.md` and/or `docs/test-coverage.md` if behavior changes.
5. Keep the work one coherent commit.

Good candidate improvements:

- Ensure admin action buttons have clear labels/aria labels and remain accessible on mobile.
- Add or harden a compact mobile detail layout for customer/actions/status.
- Add a visible "last updated / order created" helper if already available in data.
- Add a "copy phone" helper if simple and useful, with tests.
- Add tests that admin package never ships tests/config/example files.
- Add tests that admin page has `noindex`, title, and required scripts.
- Add a short "Phone manager workflow" section in docs.

Avoid:

- new dependencies;
- broad CSS rewrite;
- runtime Supabase/network tests;
- changing auth/security model;
- touching Cloudflare/Supabase settings;
- production deploy;
- generated-only commits.

## Hard Boundaries

Do not:

- push to GitHub;
- deploy preview or production;
- change Cloudflare settings;
- change Supabase settings;
- add real secrets or `.env` values;
- commit `admin/config.js`;
- commit service-role keys or screenshots;
- rewrite the architecture;
- migrate product catalog to SQL;
- change current WhatsApp fallback behavior;
- make large visual redesigns;
- commit timestamp-only `docs/project-stage-map.md` or date-only `sitemap.xml`.

## Verification

Before finishing, run:

```bash
node --check app.js
node --check admin/admin.js
node --check admin/admin.logic.js
python3 scripts/verify_backend_mvp.py
python3 scripts/check_no_secrets.py
git diff --check
git status --short --branch
```

If you add a new test, wire it into `scripts/verify_backend_mvp.py`.

## Commit Rule

If the changes are coherent and verified, make one local commit.

Suggested message:

```bash
git add <only relevant files>
git commit -m "Add admin mobile readiness guardrails"
```

If `.git/index.lock` or `.git/HEAD.lock` blocks commit and no git process is running, report the exact blocker for Codex to clear on the Mac. Do not keep retrying blindly.

## Handoff Back To Codex

Report clearly:

- commit hash if committed;
- files changed;
- checks run and whether they passed;
- dirty files left intentionally uncommitted;
- which manager/mobile workflow improved;
- what Codex should do next;
- whether the next step is Claude-safe or Codex/user-only.
