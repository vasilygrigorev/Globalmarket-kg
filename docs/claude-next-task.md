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

- `534fcb5 Add catalog field and synonym term guardrails`
- `4303bf6 Update Claude photo coverage handoff`
- `4ade484 Add photo coverage workflow guardrails`

Current state:

- Backend/Supabase/Admin MVP groundwork exists.
- Checkout can save orders through `/api/orders` when enabled and still falls back to WhatsApp.
- Admin page exists and is covered by local tests.
- Product/photo/catalog guardrails are now in the verifier.
- Current photo coverage baseline: 97 / 441 products = 22.0%.
- Latest full verifier result from Codex after `4ade484`: `Backend/admin MVP verification OK`; package OK; secret scans clean.
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
- `docs/backend-go-live-dry-run.md`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.logic.js`
- `tests/admin.logic.test.mjs`
- `tests/admin.dom.test.mjs`
- `tests/checkout.contract.test.mjs`
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

## Main Task — Admin Manager Workflow Guardrails

Make one larger local-only pass that helps turn the admin area from "technical MVP" into "manager can safely process orders" without touching live secrets or production.

Work in this order:

1. Inspect the current admin order flow:
   - login / not configured / no access states;
   - orders list;
   - order detail;
   - status changes;
   - manager comment;
   - empty/error states;
   - checkout payload expectations.
2. Identify 3-5 concrete manager-workflow contracts worth protecting with no-network tests.
3. Add focused tests and wire them into `scripts/verify_backend_mvp.py`.
4. Update admin docs/spec/checklist only where useful for future Codex/Claude/user work.
5. Keep UI/code edits small. Prefer pure helper tests or fixture DOM tests over broad redesign.

Good candidate guardrails:

- Admin status labels and allowed status transitions remain stable.
- Manager comment is rendered safely and can be saved without losing existing order data.
- Order detail includes customer, phone/WhatsApp, items, total, delivery note, attribution/source fields, and manager note area.
- Order list has readable empty states for "no orders" and "no matching orders".
- Checkout/backend contract still sends customer/source/promo/consent fields expected by admin.
- Admin never exposes service-role key or server-only config.
- Admin package includes only `admin/index.html`, `admin/admin.js`, `admin/admin.logic.js`, and not tests/config examples/secrets.
- Docs clearly define what manager can do in MVP and what stays Codex/user-only.

Avoid cosmetic redesign. The goal is safety and workflow confidence, not perfect UI.

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
git commit -m "Add admin manager workflow guardrails"
```

If `.git/index.lock` or `.git/HEAD.lock` blocks commit and no git process is running, report the exact blocker for Codex to clear on the Mac. Do not keep retrying blindly.

## Handoff Back To Codex

Report clearly:

- commit hash if committed;
- files changed;
- checks run and whether they passed;
- dirty files left intentionally uncommitted;
- whether admin MVP moved closer to manager use;
- what Codex should do next;
- whether the next step is Claude-safe or Codex/user-only.
