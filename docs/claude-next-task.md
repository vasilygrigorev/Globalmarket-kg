# Claude Next Task

Use this as the next large handoff prompt for Claude Code.

## Goal

Stop adding broad new features. Prepare the project for final handoff / production decision.

The user says it is time to finish the project. Your task is to make one final local-only release-closure pass:

- confirm the branch is technically ready for a preview/production decision;
- remove or document remaining non-production blockers;
- make the next Codex/user-only steps painfully clear;
- do not start another open-ended improvement cycle.

## Project

```text
/Users/macmini/Documents/Codex/2026-05-28-new-chat-2
```

Branch:

```text
collab/preview-baseline
```

Latest reviewed commits:

- `5a817e8 Add admin and checkout release-readiness guardrails`
- `52c3f88 Harden storefront SEO and shared-block consistency checks`
- `c140340 Document release-readiness sweep tests in test-coverage.md`
- `c43a97a Update production readiness handoff`
- `a5e3a7d Mark release-readiness sweep task as done`

Codex verification after `a5e3a7d`:

- `python3 scripts/verify_backend_mvp.py` OK.
- `python3 scripts/check_no_secrets.py` clean.
- `git diff --check` clean.

Known harmless dirty files after verification:

- `docs/project-stage-map.md` generated progress timestamp/report refresh.
- `sitemap.xml` generated date-only `lastmod` refresh.

Do not commit those two files unless your task intentionally makes a final generated-output refresh.

## Authority

You may make local commits if the changes are coherent and verified.

Allowed:

- docs cleanup;
- tests/verification guardrails;
- local release checklist improvements;
- small bug fixes discovered by tests;
- local packaging verification;
- updating this handoff when done.

Still blocked:

- no GitHub push;
- no Cloudflare preview/production deploy;
- no Supabase/Cloudflare dashboard changes;
- no secrets/env/admin-config commits;
- no live SQL migrations;
- no domain/DNS/billing changes;
- no new architecture or new feature track;
- no visual redesign.

If the remaining step is blocked by one of those items, stop and write the exact instruction for Codex/user.

## Read First

Read:

- `AGENTS.md`
- `/Users/macmini/.codex/shared-state/handoff.md`
- `/Users/macmini/.codex/shared-state/tasks.md`
- `/Users/macmini/.codex/memories/cross-chat-memory/current-focus.md`
- `docs/production-readiness.md`
- `docs/backend-go-live-checklist.md`
- `docs/api-orders.md`
- `docs/test-coverage.md`
- `docs/product-photo-rules.md`
- `scripts/verify_backend_mvp.py`
- `scripts/package_static_site.py`
- `scripts/check_deployment.py`
- `scripts/smoke_orders_api.mjs`

Start with:

```bash
git status --short --branch
git log --oneline -12
```

If there are unexpected dirty files beyond `docs/project-stage-map.md` and `sitemap.xml`, inspect and report before editing.

## Main Task — Final Release Closure

### Part A — Final Local Audit

Run or inspect enough to answer:

- Does the storefront build/package pass?
- Does admin/order backend contract pass locally?
- Does checkout still have WhatsApp fallback?
- Does package exclude tests, secrets, and admin-only unsafe files?
- Are product galleries valid?
- Are internal links valid?
- Are generated product pages and sitemap consistent?
- Is `admin/config.js` untracked/local-only and not packaged incorrectly?

If this is already covered by existing verification, do not duplicate much code. Summarize the evidence in docs.

### Part B — Production Decision Checklist

Update `docs/production-readiness.md` or `docs/backend-go-live-checklist.md` so the next human/Codex action is a short checklist, not a research project.

It must clearly separate:

1. **Ready locally**
   - branch name;
   - latest commit;
   - tests green;
   - package builds;
   - WhatsApp fallback works by code contract.

2. **Requires user/Codex production action**
   - Cloudflare Production env vars;
   - Supabase admin user confirmation;
   - production deploy command;
   - live smoke tests;
   - GitHub push/merge decision.

3. **Not blocking launch**
   - photo coverage is 92/460 and ongoing;
   - content polish can continue after launch;
   - reviews/chatbot/CRM can be future phases.

4. **Rollback**
   - restore previous Cloudflare deployment;
   - or turn off orders API flag / remove env vars so checkout falls back to WhatsApp.

### Part C — Create A One-Page Owner Handoff

Create or update a short file:

```text
docs/final-owner-handoff.md
```

Audience: non-technical owner.

Include:

- what is ready now;
- what still needs to be done to publish;
- what will happen after a customer orders;
- what the admin can currently do;
- what Petya currently does and does not do;
- what not to touch without Codex/user approval;
- next 3 practical steps.

Keep it concise and in Russian.

### Part D — Freeze The Next Work List

Update `docs/claude-next-task.md` at the end of your work to say either:

- `STATUS: READY FOR CODEX/USER PRODUCTION STEPS`, if no more Claude-safe blockers remain; or
- a single sharply-scoped remaining Claude-safe task, if you find one real blocker.

Do not invent five new tasks. We are closing.

## Verification

Before finishing, run:

```bash
python3 scripts/verify_backend_mvp.py
python3 scripts/check_no_secrets.py
git diff --check
git status --short --branch
```

If you changed scripts/tests, also run targeted syntax/test checks as appropriate.

## Commit Rules

You may make one local commit for the closure docs/guardrails.

Suggested message:

```bash
git commit -m "Add final owner handoff and production closure checklist"
```

Do not commit:

- secrets;
- `admin/config.js`;
- `.env`;
- generated-only `docs/project-stage-map.md` / `sitemap.xml` unless intentionally part of final generated refresh.

## Handoff Back To Codex

Report:

- commit hash, if committed;
- files changed;
- checks run;
- whether there are any Claude-safe blockers left;
- exact Codex/user-only next step to publish;
- dirty files intentionally left.
