# MI-2026-07-11: Product, code, and UI/UX audit

## Trigger / symptom

Project had not been reviewed recently. Requested audit against intended use: capture AI-to-human edits as voice-training data, connect those edits to Instagram performance, publish content, and manage engagement.

## Scope inspected

- Root Next.js application only. Unrelated dirty `tuckinandtalk/` worktree excluded.
- Primary edit, history, compose, queue, calendar, settings, voice analysis, performance, and engagement flows.
- API handlers, Instagram integration, publishing orchestration, schemas, navigation, global CSS, tests, build, README, and roadmap.
- Local browser rendering attempted through in-app browser and Chrome; both blocked local HTTP with `ERR_BLOCKED_BY_CLIENT`. UI conclusions therefore use component/CSS evidence, not screenshots.

## Commands run

```bash
git status --short
rg --files
wc -l ...
rg ... app lib middleware.js
npm test -- --runInBand
npm run build
npm ls --depth=0
node --input-type=module -e "import('./lib/diff.js')..."
```

Read-only local API requests were attempted, but middleware returned 401 because local `.env` does not contain admin or cron credentials.

## Files inspected

- `app/(app)/edit/page.js`
- `app/(app)/history/page.js`
- `app/(app)/history/[id]/page.js`
- `app/(app)/compose/page.js`
- `app/(app)/queue/page.js`
- `app/(app)/calendar/page.js`
- `app/(app)/analysis/page.js`
- `app/(app)/settings/page.js`
- performance and engagement pages
- `app/components/Sidebar.js` and publishing/engagement components
- relevant `app/api/**/route.js` handlers
- `lib/diff.js`, `lib/instagram.js`, `lib/publishing.js`
- all three Supabase schema files
- `app/globals.css`, `middleware.js`, `README.md`, `ROADMAP.md`, `package.json`

## Findings

### P0 — voice-training foundation invalid

1. `lib/diff.js` splits on the literal string `\\n`, not newline. Multi-line posts remain one item. Any changed post becomes one removed item plus one added item.
2. `countEdits()` forces minimum 1, including identical text.
3. Runtime probe confirmed identical, single-line changes, reordered words, and multi-line changes all return `1` edit.
4. Imported Instagram history writes caption into both `ai_version` and `final_version` with `edit_count = 0`.
5. `/api/analyse` analyses every row in `posts`, so imported non-training records dilute edit averages, trends, vocabulary, tone, and generated SKILL.md guidance.

Result: core differentiator—learning how user edits AI copy—does not currently produce trustworthy measurements.

### P0 — post identity mismatch breaks edit-to-publish linkage

- `/api/posts` exposes `post.post_id` as UI `id`.
- History passes that value as `sourcePostId` to Compose.
- `scheduled_posts.source_post_id` is a BIGINT foreign key to internal `posts.id`.
- Draft route writes external text `post_id` directly into this foreign key.
- Imported IDs use `ig_<media-id>` and cannot cast to BIGINT; normal timestamp-like `post_id` values generally do not equal internal identity IDs.

Result: Compose may prefill caption, then draft save/linkage fails. Published content cannot reliably link back to its training pair.

### P1 — scheduled cancel deletes evidence

- Queue and Calendar call `DELETE /api/publish/draft` for scheduled cancellation.
- Draft DELETE removes media and hard-deletes `scheduled_posts` without checking status.
- Dedicated `/api/publish/cancel` exists and preserves row with `cancelled` status but is unused by these screens.
- Cascade deletion also removes publishing logs.

Result: cancel action destroys audit/history data and bypasses intended state machine.

### P1 — matching and dates use mixed identifiers / false timestamps

- Per-post match-suggestion UI filters using external `post_id`; `match_suggestions.post_id` references internal `posts.id`.
- Manual linking sets `published_at` to current time instead of selected Instagram media timestamp.

Result: per-post suggestions can appear empty; timing/cadence analytics receive wrong publication dates.

### P1 — publishing concurrency not claimed atomically

- Publish-now and cron read eligible rows, then update status separately.
- Updates do not condition on prior status and do not claim rows transactionally.
- Concurrent manual/cron invocations can both progress same scheduled post.

Result: duplicate publication risk.

### P1 — OAuth completion loses context and feedback

- Callback redirects success/errors to `/?instagram_*=`.
- Root immediately redirects to `/edit` without preserving query.
- No UI reads these query parameters.

Result: connection returns user to wrong screen and discards success/error explanation.

### P1 — scope overwhelms primary job

- Sidebar exposes 16 destinations across six sections.
- Root job is a two-step editor, but navigation gives publishing, engagement, six performance dashboards, gallery, history, and settings similar weight.
- No home/work queue answers “what should I do next?”
- Voice-training journey stops at copyable SKILL.md text; no versioning, review, application, or measured feedback loop.

Result: product behaves as several admin tools sharing a sidebar, not one coherent refinement loop.

### P2 — UX/accessibility gaps

- Primary editor hardcodes “Claude Chat” despite product copy claiming any AI tool.
- Topic label lacks input association. Main textareas have placeholder-only labeling.
- Hidden disabled input is used as layout spacer.
- Many icon-only buttons lack accessible names.
- muted text `#6b6b6b` and dim text `#444` on dark cards are low contrast, including instructions/section labels.
- animations have no `prefers-reduced-motion` fallback.
- no route-level `loading.js` or `error.js`; each client page reinvents loading/error handling, often swallowing fetch errors.
- all app pages/components are client components and fetch after mount, causing repeated loading flashes and duplicated connection checks.

### P2 — maintainability and operational confidence

- Roughly 18,000 lines reviewed; several pages are 500–880 lines, with extensive inline style duplication.
- Test suite contains only four root-layout assertions. No tests cover diff, analysis, identity linkage, publishing state transitions, OAuth redirect, or comment flows.
- Build passes but warns about inferred workspace root and deprecated `middleware` convention.
- README setup is stale: versions differ, Node requirement is outdated for Next 16, and required service-role/auth/cron variables plus engagement/publishing schemas are omitted.
- Webhook comment upsert can reset an already replied comment to `unreplied` and increment badge count again on duplicate delivery.

## Direct answers / conclusions

Project is feature-rich but unreliable at its claimed differentiator. Biggest problem is not missing features; it is invalid training data and broken cross-flow identity. UI then amplifies this with too many equal-priority destinations and weak feedback between refine, publish, measure, and learn.

## Proposed surgical fix

1. Establish canonical internal `posts.id` across APIs/UI/FKs; expose separate `publicId` if needed. Add migration and linkage tests.
2. Replace diff/edit counter with tested line/word diff; allow zero edits; backfill stored edit counts.
3. Mark record origin/type (`training_pair`, `instagram_import`) and exclude imports from voice analysis by construction.
4. Route Queue/Calendar cancel through cancel endpoint; restrict hard delete to drafts/failed records.
5. Add atomic publishing claim (conditional update/RPC/transaction) and idempotency guard.
6. Preserve real Instagram timestamp during manual links; fix match filtering to canonical ID.
7. Redirect OAuth to Settings with durable success/error feedback.
8. Reframe navigation around Refine → Publish → Measure → Learn; hide advanced operations under secondary areas.
9. Add unit/integration coverage around core data invariants before expanding scope.

## Files changed

- Added this audit record and `docs/mi/README.md` only.
- No application code changed.

## Validation status

- `npm test -- --runInBand`: pass, 1 suite / 4 tests.
- `npm run build`: pass; workspace-root and middleware deprecation warnings.
- Diff runtime probe: reproduced invalid edit counts.
- Visual runtime validation: blocked by local browser policy; not completed.

## Current status / next steps

Audit complete. Recommended first repair slice: canonical post identity + diff/count correctness + training/import separation. Do not add Phase 3 AI generation until these data invariants are repaired and historical records backfilled.
