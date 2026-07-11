# MI-2026-07-11: Canonical post identity

## Trigger / symptom

`/api/posts` exposed `posts.post_id` as `id`, while metrics, matching, and publishing foreign keys reference `posts.id`. History, Compose, draft creation, and manual linking therefore passed incompatible identifiers between flows. Manual linking and suggestion acceptance could also fabricate publication time from current server time.

## Scope inspected

- Post logging/listing and history detail UI
- Compose-to-draft linkage
- Manual and suggested Instagram linking
- Automatic matching and publishing completion
- Core and publishing schemas

## Commands run

- `rg --files -g 'AGENTS.md'`
- `rg -n "post_id|sourcePostId|source_post_id|published_at|matched|match" app lib`
- Focused `sed` inspection of affected routes, UI, publishing code, and schemas
- `npm ci`
- `npm test -- --runInBand app/api/posts/route.test.js app/api/publish/draft/route.test.js app/api/posts/match/route.test.js app/api/posts/link/route.test.js`
- `npm test -- --runInBand`
- `npm run build`
- `git diff --check`

## Files inspected

- `app/api/posts/route.js`
- `app/api/log/route.js`
- `app/(app)/history/[id]/page.js`
- `app/(app)/compose/page.js`
- `app/api/publish/draft/route.js`
- `app/api/posts/link/route.js`
- `app/api/posts/match/route.js`
- `lib/publishing.js`
- `lib/supabase-schema.sql`
- `lib/supabase-schema-publishing.sql`

## Findings

- `posts.id` is already canonical database identity and all internal foreign keys use it.
- `/api/posts` and `/api/log` incorrectly replaced canonical identity with legacy `post_id`.
- `scheduled_posts.source_post_id` already targets `posts.id`, so Compose could submit an incompatible text ID.
- Manual link/unlink queried `posts.post_id`, unlike match resolution and publishing.
- Recent-media payload already includes Graph `timestamp`, but manual link UI discarded it.
- Publish pipeline fetched Graph media timestamp, but discarded it and wrote local current time.
- Match suggestions did not persist Instagram timestamp; acceptance fell back to local current time.

## Direct answers / conclusions

Canonical API/UI identity must be `posts.id`. `posts.post_id` remains exposed and accepted as a legacy/public identifier. Incoming identifiers resolve canonical-first, then legacy, preventing numeric legacy IDs from breaking saved links.

## Proposed surgical fix

- Expose canonical `id` plus legacy `postId` and `post_id`.
- Add shared canonical-first identity resolver.
- Normalize legacy history/Compose links before draft persistence.
- Filter per-post suggestions by resolved canonical ID.
- Use canonical ID for manual link/unlink.
- Carry Graph timestamps through manual linking, suggestions, and publish completion.
- Add nullable, idempotent schema migration; do not rewrite existing IDs.

## Files changed

- `lib/post-identity.js`: canonical-first, legacy-fallback resolver
- `app/api/posts/route.js`, `app/api/log/route.js`: canonical response ID plus legacy aliases
- `app/(app)/history/[id]/page.js`, `app/(app)/compose/page.js`: compatible detail/source lookup and timestamp forwarding
- `app/api/publish/draft/route.js`: canonical source foreign-key normalization
- `app/api/posts/link/route.js`: canonical manual link/unlink and actual timestamp storage
- `app/api/posts/match/route.js`: canonical per-post filtering and suggestion timestamp propagation
- `lib/publishing.js`: Graph timestamp propagation into scheduled and source posts
- `lib/supabase-schema.sql`, `lib/supabase-schema-publishing.sql`: baseline schema updates
- `lib/migrations/2026-07-11-canonical-post-linkage.sql`: additive production migration
- Four route test files covering required identity/linkage cases
- `docs/mi/README.md` and this MI record

## Validation status

- Targeted tests: passed, 4 suites / 4 tests.
- Full tests: passed, 5 suites / 8 tests.
- Production build: passed, 66 routes generated.
- `git diff --check`: passed.
- Build emitted existing workspace-root and middleware-deprecation warnings; neither blocked compilation.

## Current status / next steps

Implementation complete. Apply `lib/migrations/2026-07-11-canonical-post-linkage.sql` before or with deployment. Migration is additive and idempotent; it does not rewrite `posts.id` or `posts.post_id`. Code tolerates pre-migration match-suggestion inserts, but Graph timestamps on new suggestions require the new column.

Workstream 1 has no committed diff at the shared base during this closeout. No runtime dependency was found. Likely merge-conflict surfaces are `/api/log`, `/api/posts`, or shared post DTO expectations. Preserve this contract during integration: `id = posts.id`; `postId` and `post_id = posts.post_id`.
