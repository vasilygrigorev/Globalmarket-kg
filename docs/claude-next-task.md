# Claude Next Task

> **STATUS: READY FOR CODEX/USER PRODUCTION STEPS.**
>
> The final release-closure pass (2026-07-03) found no remaining Claude-safe
> blockers. Full local suite 240/240, package/secret scans clean, gallery
> contract clean, internal links clean, checkout WhatsApp fallback verified
> in code. Everything that remains needs Cloudflare/Supabase dashboard
> access, secrets, or a deploy/push decision — see
> `docs/production-readiness.md` section 2 for the exact steps, and
> `docs/final-owner-handoff.md` for the plain-language (Russian) summary.
>
> Codex: replace this file's body with the next task when there is one. Do
> not restart an open-ended improvement cycle without a specific new goal
> from the user — the project is intentionally closed for broad new work
> right now.

## Where things stand

Project: `/Users/macmini/Documents/Codex/2026-05-28-new-chat-2`, branch
`collab/preview-baseline`.

Latest closure-pass commit: see `git log --oneline -3` and
`/Users/macmini/.codex/shared-state/handoff.md` (top entry) for the exact
hash and file list.

Read first if resuming work here:

- `docs/production-readiness.md` — the short go/no-go checklist (ready
  locally / needs Codex-user / not blocking / rollback).
- `docs/final-owner-handoff.md` — one-page Russian summary for the
  non-technical owner.
- `docs/backend-go-live-checklist.md` — exact commands for the privileged
  production steps.
- `docs/test-coverage.md` — what every test file guards.

Known harmless dirty files after any full verification run:

- `docs/project-stage-map.md` — generated timestamp/report refresh.
- `sitemap.xml` — generated date-only `lastmod` refresh.

Do not commit those two unless a task intentionally makes a final generated
refresh.

## If starting new work

- Any broad new feature track (reviews, CRM, chatbot, customer history) is
  explicitly a future phase, not something to start unprompted.
- Photo coverage (92/460, 20.0%) is an ongoing, separate content task — safe
  to continue on its own, but do not bundle it with production-decision work.
- Production deploy, Cloudflare/Supabase settings, secrets, `git push`, and
  live SQL remain Codex/user-only regardless of what Claude-safe work happens
  next.
