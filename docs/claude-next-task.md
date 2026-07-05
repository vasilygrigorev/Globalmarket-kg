# Claude Next Task

> **STATUS: PETYA RAW PHOTO TRIAGE GUARDRAIL DONE. Waiting on Petya for 2 photos.**
>
> This task (close the remaining Dove photo ambiguity, add a triage guardrail,
> prepare a Russian request list) is complete. See "Outcome" below. There is
> no open Claude-safe blocker right now other than the two missing photos
> from Petya. Codex: replace this file's body with the next task when there
> is one.

## Outcome (2026-07-05)

- **Task A (reviewable Dove state):** `docs/pending-photo-review.md` already
  had the per-variant breakdown (cap color, product_id/source_code, exactly
  what's missing); added a plain Russian request section at the bottom for
  Petya/owner. No Dove photo was published — both remaining variants
  (Apple & White Tea, Original) still have only 2 of the required 3 photos.
- **Task B (guardrail):** added `scripts/report_raw_photo_groups.py` +
  `tests/raw-photo-triage.test.mjs`, wired into
  `scripts/verify_backend_mvp.py` (both the node test list and a new
  `--strict` preflight step). It scans loose files directly under
  `assets/products/`, groups them by filename prefix, and flags any
  **undocumented** group — whether it looks like a complete
  card-front/front/back triple or not — that isn't already written up in
  `docs/pending-photo-review.md`. It never deletes or moves files. The
  current Dove leftovers are documented, so `--strict` passes; a genuinely
  new/unsorted Petya drop would now fail the preflight instead of silently
  sitting unreviewed.
- **Task C (Russian request list):** added to
  `docs/pending-photo-review.md` under "Что нужно от Пети/владельца".

Verification after this task: `verify_product_galleries.py` OK (122/529
with photos); `verify_backend_mvp.py --skip-package` OK; `check_no_secrets.py`
clean; `git diff --check` clean.

## Context carried forward

Remaining raw files (untouched, not published, not deleted):

```text
assets/products/telegram-989425384-20260703-160531-01-*
assets/products/telegram-989425384-20260703-160531-02-*
```

These are 3 Dove variants across only 2 photos each (see
`docs/pending-photo-review.md` for full detail):

- teal cap: Dove Advanced Care Pear & Aloe Vera — already published, redundant.
- red cap: Dove go fresh Apple & White Tea (`prd_f23090eb2627`, source_code 120)
  — needs one more `card-front` photo, or an explicit "publish with 2" OK.
- blue cap: Dove Advanced Care Original (`prd_b8b5bfec07e5`, source_code 806)
  — same, needs one more photo or explicit OK.

## Next candidate tasks (pick one, or wait for a new user goal)

1. **Waiting on Petya/user** — once a third photo (or explicit 2-photo
   exception approval) arrives for Apple & White Tea and/or Original, add
   the override entries and regenerate, following the same pattern as the
   YC sunscreen batch (`290c609`, `b1ca708`).
2. **Optional Claude-safe cleanup**: `docs/product-photo-rules.md`'s
   "card+front only" exception list documents 3 legacy exceptions
   (`prd_432b62d4b317`, `prd_1f1557a2acbb`, `prd_296bd01a7c1f`) still
   missing a back photo — could revisit whether any have since been
   reshot, or leave as-is.
3. **Codex/user-only**: GitHub push/merge decision (branch
   `collab/preview-baseline` is still ahead of any pushed remote state from
   this session's local commits), and the standing Supabase
   `SUPABASE_SERVICE_ROLE_KEY` / production-secret items noted in prior
   handoffs — unrelated to photo work, still open from earlier sessions.

Do not restart an open-ended improvement cycle without a specific new goal
from the user.
