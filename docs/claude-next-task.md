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

Latest local checkpoint before this handoff:

- `7228919 Add storefront checkout and SEO contract tests`

Current state:

- Backend/Supabase/Admin MVP groundwork exists.
- Checkout can use the backend behind the configured flag and still falls back to WhatsApp.
- Admin page exists and is covered by local tests.
- Product pages, landing pages, sitemap, robots, shared header/footer, menu, category strip, SEO, and checkout contracts are covered by `scripts/verify_backend_mvp.py`.
- Do not push or deploy production unless the user explicitly asks.

Known harmless dirty files after a full verification run:

- `docs/project-stage-map.md` may contain a generated timestamp-only change.
- `sitemap.xml` may contain generated `lastmod` date-only changes.

Do not commit those two unless the task explicitly needs them.

## Read First

Before editing, read:

- `AGENTS.md`
- `docs/project-stage-map.md`
- `docs/test-coverage.md`
- `docs/current-tech-improvements.md`
- `docs/backend-go-live-checklist.md`
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

If there are unrelated or conflicting changes, stop and report them.

## Main Task — Storefront Quality Pass

Make one larger local-only pass over the storefront so future visual/catalog changes are safer.

Work in this order:

1. Inspect the current homepage, product-page, category-strip, shared header/footer, menu, and checkout-related tests.
2. Find 2-4 realistic gaps that can be protected by local no-network tests or small docs updates.
3. Add tests only where they prevent real regressions. Prefer contract tests that read HTML/CSS/JS/data files over brittle pixel-perfect tests.
4. If a tiny code/doc fix is required to make an existing behavior consistent, do it narrowly.
5. Keep all changes local-only and production-safe.

Good candidate areas:

- product cards keep the expected action set: add to cart, favorite, product open/details, price, registration discount text;
- category strip and menu stay aligned with `data/site-config.json`;
- search synonyms still point to real categories/brands/collections and include user brainstorm words;
- product pages and homepage keep shared header/footer without drifting;
- checkout still works without registration and keeps WhatsApp fallback;
- backend orders API stays disabled/enabled only via config flag and never removes fallback;
- robots/sitemap/product canonical consistency;
- package excludes tests and secrets but includes required runtime files.

Do not spend time on perfect design. This task is guardrails, consistency, and small safe fixes.

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
- introduce a new framework;
- make large visual redesigns;
- commit timestamp-only `docs/project-stage-map.md` or date-only `sitemap.xml`.

## Verification

Before finishing, run:

```bash
node --check app.js
python3 scripts/verify_backend_mvp.py
python3 scripts/check_no_secrets.py
git diff --check
git status --short --branch
```

If you add a new test, wire it into `scripts/verify_backend_mvp.py`.

## Commit Rule

If the changes are coherent and verified, make one local commit.

Suggested message format:

```bash
git add <only relevant files>
git commit -m "Add storefront consistency guardrails"
```

If `.git/index.lock` or `.git/HEAD.lock` blocks commit and no git process is running, report the exact blocker for Codex to clear on the Mac. Do not keep retrying blindly.

## Handoff Back To Codex

Report clearly:

- commit hash if committed;
- files changed;
- checks run and whether they passed;
- dirty files left intentionally uncommitted;
- what Codex should do next;
- whether the next step is Claude-safe or Codex/user-only.

