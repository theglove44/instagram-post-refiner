# MI-2026-07-11 Training-data integrity

## Trigger / symptom

Multiline captions were diffed as one line, identical captions reported one edit,
and imported Instagram history was included in voice/training analysis.

## Scope inspected

- Diff, edit-count, and similarity helpers
- Log, Instagram import, polling, and analysis routes
- Posts schema and historical migration path
- Existing Jest/build setup

## Commands run

```bash
rg --files
rg -n "computeDiff|countEdits|from('posts')|edit_count" app lib
npm test -- --runInBand
npm ci
npm test -- --runInBand
npm run build
node scripts/recalculate-edit-counts.cjs --apply
git diff --check
```

## Files inspected

- `lib/diff.js`
- `lib/supabase-schema.sql`
- `app/api/log/route.js`
- `app/api/instagram/import/route.js`
- `app/api/cron/poll-new-posts/route.js`
- `app/api/analyse/route.js`
- `package.json`

## Findings

- Diff used `/\\n/` and similarity used `/\\s+/`, matching literal backslash
  sequences instead of newlines/whitespace.
- `countEdits` forced a minimum of one and used `ceil(changes / 2)`, which
  undercounted unpaired additions/removals.
- Importers stored identical AI/final captions without a record-origin marker.
- Analysis selected every posts row, so imported history polluted training data.
- Existing importer IDs consistently use the `ig_` prefix; linked logged rows
  cannot safely be identified using `instagram_media_id` alone.

## Direct answers / conclusions

- Identical text must report zero edits.
- CRLF/CR/LF differences are equivalent. Blank and whitespace-only lines remain
  meaningful caption content.
- Explicit `origin` values are `training_pair` and `instagram_import`.
- Legacy null/missing origins remain compatible: `ig_` rows are imports; other
  rows are training pairs.

## Proposed surgical fix

- Use normalized line endings and LCS line alignment.
- Count edits as `max(additions, removals)`, pairing replacements one-to-one.
- Mark every writer explicitly and filter analysis through shared origin logic.
- Add idempotent schema migration plus opt-in historical recalculation command.

## Files changed

- Diff implementation and unit tests
- Shared post-origin helper and tests
- Log/import/poll/analyse routes
- Base schema and origin migration
- Dry-run-first edit-count recalculation script
- README rollout instructions and package script
- MI record/index

## Validation status

- Initial test attempt: blocked because dependencies were absent (`jest: command not found`).
- `npm ci`: passed; 409 locked packages installed. npm reported five dependency
  audit findings (one low, two moderate, two high); no automatic upgrade applied.
- `npm test -- --runInBand`: passed, 3 suites and 25 tests.
- `npm run build`: passed. Existing Next.js warnings remain for inferred workspace
  root and deprecated middleware convention.
- `node scripts/recalculate-edit-counts.cjs --apply`: correctly refused writes
  without the required confirmation token.
- `git diff --check`: passed.

## Current status / next steps

Run origin migration before application deployment. Dry-run edit-count report,
review it, then explicitly apply recalculation during a maintenance window.
