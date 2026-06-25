# Claude Next Task

Use this file as the next handoff prompt for Claude Code.

## Context

Project:

```text
/Users/macmini/Documents/Codex/2026-05-28-new-chat-2
```

Current branch:

```text
collab/preview-baseline
```

Latest local commits before this handoff:

- `64a1a51 Add Cloudflare headers and image sitemap`
- `66d6bde Document backend MVP plan`

No GitHub push and no production deploy should be done unless the user explicitly asks.

## Read First

Before editing, read:

- `AGENTS.md`
- `docs/agent-runbook.md`
- `docs/backend-mvp-plan.md`
- `docs/customer-database-plan.md`
- `docs/project-stage-map.md`
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

## Task

Start the Supabase/backend MVP preparation, but do not connect the frontend yet.

Implement the first safe backend layer as project files only:

1. Create a migration folder if missing, for example:

```text
supabase/migrations/
```

2. Add the initial SQL migration for the MVP tables from `docs/backend-mvp-plan.md`:

- `customers`
- `orders`
- `order_items`
- `marketing_attribution`
- `customer_consents`

3. Add RLS policies or at least a documented RLS-ready structure.

Minimum security rules:

- customers/orders are not publicly readable;
- frontend must never receive a service role key;
- anonymous order insert must be handled only through a safe server/edge layer later;
- manager/admin access must be separate from public customer actions.

4. Add a short doc if needed:

```text
docs/supabase-setup.md
```

It should explain:

- what to create in Supabase;
- where migrations live;
- which keys must stay out of git;
- what the next frontend integration step will be.

## Do Not Do Yet

- Do not add Supabase keys.
- Do not create `.env` with real secrets.
- Do not wire checkout to Supabase yet.
- Do not change current WhatsApp order behavior.
- Do not migrate catalog/products to database.
- Do not add authentication UI yet.
- Do not add reviews UI yet.
- Do not push to GitHub.
- Do not production deploy.

## Verification

Before finishing:

```bash
git diff --check
git status --short --branch
```

If a build-affecting file changed, also run:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/pycache-globalmarket python3 scripts/package_static_site.py --include-reports
```

## Commit Rule

If the changes are coherent and verified, make one local commit, for example:

```bash
git add supabase docs/supabase-setup.md
git commit -m "Add Supabase backend schema"
```

If commit is blocked, leave the working tree staged or clearly report:

- changed files;
- checks run;
- exact blocker;
- whether Codex should commit.

## Handoff Back To Codex

After work, report:

- commit hash if committed;
- files changed;
- checks run;
- whether git tree is clean;
- what Codex should do next.

