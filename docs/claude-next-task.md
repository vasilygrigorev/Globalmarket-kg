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

- `4ade484 Add photo coverage workflow guardrails`
- `0ed6728 Add admin manager workflow guardrails`
- `d79c0cf Add storefront accessibility guardrails`

Current state:

- Backend/Supabase/Admin MVP groundwork exists.
- Checkout can save orders through `/api/orders` when enabled and still falls back to WhatsApp.
- Admin page exists and has manager workflow guardrails.
- Storefront a11y guardrails for card/product images are now wired into `scripts/verify_backend_mvp.py`.
- Current photo coverage baseline: 97 / 441 products = 22.0%.
- Latest full verifier result from Codex after `d79c0cf`: `Backend/admin MVP verification OK`; package OK; secret scans clean.
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

## Main Task — Admin Manager Usability Pass

Make one larger local-only pass that moves the admin closer to daily manager use without touching live secrets or production.

Focus on practical workflow, not redesign. The manager should be able to quickly understand and process orders.

Work in this order:

1. Inspect current admin UI and helpers:
   - order list columns;
   - order detail layout;
   - status filter/search;
   - manager comment;
   - customer/source fields;
   - any existing copy/export/message helpers.
2. Add 2-4 small useful admin improvements if they are low-risk.
3. Add no-network tests for the new behavior and wire them into `scripts/verify_backend_mvp.py`.
4. Update `docs/admin-orders-spec.md` and/or `docs/test-coverage.md` if behavior changes.
5. Keep the changes small enough for one coherent commit.

Good candidate improvements:

- Add or harden a "copy order summary" helper for manager workflow, returning clean WhatsApp-readable text.
- Add a CSV/export helper for selected/listed orders if not already present, with tests.
- Make status filter/search behavior testable and stable.
- Ensure order detail always shows customer name, phone/WhatsApp, source/promo/consent, address/city if present, items, total, status, and manager note.
- Add a readable "empty filtered result" state distinct from "no orders yet".
- Add a small admin documentation section: "Manager MVP workflow" with exact steps.

Avoid:

- cosmetic-only redesign;
- broad CSS rewrites;
- new dependencies;
- runtime calls to Supabase in tests;
- changing auth/security model.

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
git commit -m "Improve admin manager usability guardrails"
```

If `.git/index.lock` or `.git/HEAD.lock` blocks commit and no git process is running, report the exact blocker for Codex to clear on the Mac. Do not keep retrying blindly.

## Handoff Back To Codex

Report clearly:

- commit hash if committed;
- files changed;
- checks run and whether they passed;
- dirty files left intentionally uncommitted;
- which manager workflow improved;
- what Codex should do next;
- whether the next step is Claude-safe or Codex/user-only.
