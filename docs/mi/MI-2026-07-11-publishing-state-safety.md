# MI-2026-07-11: Publishing state safety

## Trigger / symptom

Queue and Calendar cancelled scheduled posts through hard delete. Publish-now and cron used separate status reads and writes, allowing concurrent workers to publish one post twice.

## Scope inspected

Publishing API routes, publishing orchestration, scheduled cleanup, Queue/Calendar callers, publishing schema, and test setup. `tuckinandtalk/` excluded.

## Commands run

```bash
rg --files -g '!tuckinandtalk/**' -g '!node_modules/**'
rg -n "api/publish/(draft|cancel)|DELETE|delete|cancel|publish" app lib
sed -n ... app/api/publish/now/route.js app/api/cron/publish/route.js
sed -n ... app/api/publish/draft/route.js app/api/publish/cancel/route.js
sed -n ... lib/publishing.js lib/supabase-schema-publishing.sql
```

## Files inspected

- `app/(app)/queue/page.js`
- `app/(app)/calendar/page.js`
- `app/api/publish/{now,cancel,draft}/route.js`
- `app/api/cron/{publish,publish-cleanup}/route.js`
- `lib/publishing.js`
- `lib/supabase-schema-publishing.sql`

## Findings

- Queue and Calendar called draft DELETE for scheduled-post cancellation.
- Draft DELETE did not validate current status and deleted storage before database state.
- Cleanup deleted cancelled records after seven days and cascaded publishing logs.
- Publish-now and cron selected eligible posts, then updated status without a conditional atomic claim.
- A DB finalization failure after successful Instagram publication entered normal retry handling, risking duplicate publication.

## Direct answers / conclusions

Cancellation must be a retained state transition. Hard delete is limited to draft/failed rows. Publishing logs must survive parent deletion. Both entry points need one database-owned claim operation. Failures after Meta publication must never auto-retry.

## Proposed surgical fix

- Route Queue/Calendar cancellation through `/api/publish/cancel`.
- Add conditional cancel/delete predicates and conflict responses.
- Preserve cancelled rows during cleanup; delete only their old media.
- Change publishing-log FK to `ON DELETE SET NULL`.
- Add `claim_scheduled_post_for_publishing` SQL RPC using one conditional `UPDATE ... RETURNING`.
- Use claim result in publish-now/cron and distinguish lost claim, RPC failure, ordinary publish failure, and state-save failure.
- Add state-matrix, concurrent-claim, claim-failure, and route guard tests.

## Files changed

- Queue and Calendar cancellation callers now use the cancel endpoint.
- Cancel and hard-delete routes apply conditional state predicates and return conflicts on races.
- Publish-now and cron use the atomic claim helper/RPC and expose lost/error claim outcomes.
- Publishing finalization prevents automatic retry after successful Meta publication.
- Cleanup retains cancelled posts and logs while removing old media.
- Initial schema plus standalone deployment migration define RPC permissions and audit FK retention.
- Tests cover state matrices, competing claims, due-claim parameter, route conflict/error outcomes, and cron stale-list behavior.

## Validation status

Passed:

```bash
npm test -- --runInBand lib/publish-state.test.js app/api/publish/now/route.test.js app/api/publish/draft/route.test.js app/api/cron/publish/route.test.js
# 4 suites, 22 tests passed

npm test -- --runInBand
# 5 suites, 26 tests passed

npm run build
# Next.js production build compiled, type-checked, and generated 66 static pages

git diff --check
# clean
```

Build emitted existing workspace-root and middleware-deprecation warnings. No build failure.

## Current status / next steps

Implementation and validation complete. Apply `lib/supabase-migration-publishing-state-safety.sql` before deploying application code, then commit locally. No push or merge.
