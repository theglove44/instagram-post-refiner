# MI-2026-07-11 Release training-integrity integration

## Trigger / symptom

Four independently developed release commits needed integration onto current `origin/main` without losing overlapping training-data, post-identity, publishing-state, or OAuth/UX behavior.

## Scope inspected

- Release base: `origin/main` at `4fc39ef`
- Training-data integrity: `0a5bbf9`
- Canonical post identity: `c8e8b08`
- Publishing-state safety: `b500c52`
- OAuth feedback and UX shell: `453fb8f`
- Expected overlap areas: log API, compose UI, draft publishing API/tests, publishing helpers/schema, and DevOps MI index

## Commands run

```text
git fetch --prune origin main
git switch -c codex/release-training-integrity origin/main
git cherry-pick 0a5bbf9
git cherry-pick c8e8b08
git cherry-pick b500c52
git cherry-pick 453fb8f
npm ci
npm test -- --runInBand
npm run build
git diff --check
```

Release validation commands and results are recorded below after completion.

## Files inspected

- `app/api/log/route.js`
- `app/(app)/compose/page.js`
- `app/api/publish/draft/route.js`
- `app/api/publish/draft/route.test.js`
- `lib/publishing.js`
- `lib/supabase-schema.sql`
- `lib/supabase-schema-publishing.sql`
- `docs/mi/README.md`
- All four source commit file lists and conflict stages

## Findings

- `app/api/log/route.js`, compose UI, and `lib/publishing.js` merged automatically while retaining changes from both touching workstreams.
- Canonical post linkage and publishing-state safety both changed draft publishing behavior. Integrated route resolves `sourcePostId` to canonical `posts.id` and also limits hard deletion to safe statuses with a compare-and-delete state guard.
- Draft route tests were combined so canonical linkage and hard-delete preservation remain covered.
- Publishing schema retains canonical `source_post_id` migration notes/index plus atomic claim function and `publishing_log` retention constraint.
- Each source commit created `docs/mi/README.md` independently. Index was manually consolidated without dropping entries.
- Root worktree and `tuckinandtalk/` changes were not modified.
- Production migration verification found Supabase's role-specific default function grant left `anon` able to execute the `SECURITY DEFINER` publishing-claim RPC after revoking only `PUBLIC`. Explicit revokes for `anon` and `authenticated` were applied to production and added to both canonical SQL sources.

## Direct answers / conclusions

All four requested changes can coexist. Conflict resolution required unioning behavior, not choosing one workstream over another.

## Proposed surgical fix

Cherry-pick requested commits in supplied order, manually combine only conflicting behavior/index content, then verify clean install, full Jest suite, production build, and whitespace integrity.

## Files changed

- Four requested commit file sets
- `docs/mi/MI-2026-07-11-release-training-integrity-integration.md`
- `docs/mi/README.md`

## Validation status

- `npm ci`: passed; 409 packages installed
- `npm test -- --runInBand`: passed; 15 suites, 59 tests
- `npm run build`: passed; optimized production build and 66 static pages generated
- `git diff --check`: passed after final integration record update
- Supabase migrations: applied to `Instagram Editor` (`ucpkeymrxbgmkkmmcgha`); post-origin backfill produced 114 training pairs and 1,811 Instagram imports with zero null origins
- Supabase privilege verification: `service_role` can execute publishing-claim RPC; `anon` and `authenticated` cannot
- Supabase advisors: no new migration-specific findings; existing warnings remain for mutable `increment_engagement_count` search path and broad public `post-media` listing policy, plus informational unused-index notices

## Current status / next steps

Integration and full local validation complete. Commit MI integration record, push branch, open and merge one PR, apply available database migrations, deploy through VM protocol, verify service/application health, and review edit-count dry-run before any confirmed mutation.
