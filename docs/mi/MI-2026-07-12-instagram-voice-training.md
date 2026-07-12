# Instagram voice training data and Codex skill refinement

## Trigger / symptom

User requested end-to-end use of `/analysis` and `/history` data to train GPT/Codex on Chris's writing style, structure, and tone.

## Scope inspected

- Live Supabase `posts` corpus
- `/analysis` UI and `/api/analyse`
- `/history` paired AI/final data model
- Original Claude `instagram-posts.skill`
- Project-local Codex skill conventions

## Commands run

```bash
npm test -- --runInBand
npm run build
python3 /Users/christaylor/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/instagram-posts
node .codex/skills/instagram-posts/scripts/check-caption.mjs /tmp/instagram-caption-check.txt
```

Live corpus was queried read-only through existing Supabase configuration to validate pagination and labels.

## Files inspected

- `app/api/analyse/route.js`
- `app/(app)/analysis/page.js`
- `app/(app)/history/page.js`
- `app/api/posts/route.js`
- `lib/diff.js`
- `lib/supabase-server.js`
- Original `instagram-posts.skill`

## Findings

- Corpus contained 1,927 records.
- Only 114 records were genuine AI-to-final edited pairs.
- 1,813 records were final-only imports duplicated into both text columns.
- Current analyzer treated identical imports as transformation evidence, swamping genuine pairs.
- Single Supabase query could silently stop at server row cap; explicit pagination was required.
- 212 records qualified as current likely-Chris voice examples.
- 357 records matched likely-Tommo author signals and require separate handling.
- 1,078 records were legacy references with formatting that should not define current style.
- Existing “voice consistency score” was a subjective heuristic based on phrase and emoji lists, not dataset readiness.
- `proper` and `bang on` were classified as positive British expressions despite repeated removal evidence.

## Direct answers / conclusions

- Genuine pairs must drive edit/transformation metrics.
- Final-only imports remain useful as style exemplars, never as zero-edit AI successes.
- Current, likely-Chris records should outrank legacy and likely-Tommo records.
- Skill needs factual non-invention rules, post-type playbooks, gold transformations, and deterministic validation.

## Proposed surgical fix

- Classify records by type, author signal, era, and quality.
- Paginate full corpus.
- Restrict analyzer transformation metrics to edited pairs.
- Replace voice score display with evidence-based training readiness.
- Add labelled training JSON export.
- Create validated project-local Codex skill and packaged `.skill` artifact.

## Files changed

- `lib/training-data.js`
- `lib/training-data.test.js`
- `app/api/analyse/route.js`
- `app/api/analyse/training/route.js`
- `app/(app)/analysis/page.js`
- `.codex/skills/instagram-posts/**`
- `dist/instagram-posts.skill`
- `docs/mi/README.md`
- `docs/mi/MI-2026-07-12-instagram-voice-training.md`

## Validation status

- `npm test -- --runInBand` — passed, 2 suites / 9 tests.
- `npm run build` — passed; `/api/analyse/training` included in production routes.
- `quick_validate.py` — passed; skill valid.
- Caption checker smoke test — passed.
- Live corpus pagination/classification — passed with 1,927 records.
- Build retained pre-existing warnings about multiple lockfiles and deprecated `middleware` convention.

## Current status / next steps

Implemented and validated. Future edit pairs automatically improve analyzer evidence without mixing final-only imports into transformation metrics.

## Claude archive enrichment

### Trigger

User supplied `claude-archive-export-tuckinandtalk-posts-20260712.json` to improve Codex skill from full Claude project history.

### Archive inspected

- 145 conversations
- 632 total messages
- 87 caption-producing conversations
- 148 assistant caption variants containing `#tuckinandtalk`
- Explicit user-final captions and iterative criticism across restaurant, recipe, drink, travel, product, event, and gifted posts

### Findings

- Drafts repeatedly failed when brain-dump order became caption order.
- User repeatedly requested shorter question hooks, better connective storytelling, and more strategic emoji.
- User explicitly rejects em dashes and alien phrases such as `this place goes off` and `Reader, we cleared the lot`.
- User-final captions are stronger evidence than first assistant drafts.
- Five hashtags with `#tuckinandtalk` first is current house style.
- Reel first-line maximum of 55 characters is a user house rule.
- Verified handles and product names are useful; guessed handles are not acceptable.

### Skill changes

- Added `references/archive-lessons.md`.
- Expanded `references/gold-captions.md` with explicit user-final examples for hidden bars, mixed restaurant visits, product discoveries, and gifted home food.
- Made archive lessons and closest gold-caption selection mandatory before drafting.
- Added no-em-dash, connected-storytelling, concise-hook, emoji, exact-five-hashtag, and verification rules.
- Tightened deterministic caption checker for exact hashtag count and em dashes.

### Validation

- Skill schema validation: passed.
- Caption checker smoke test: passed after updated five-hashtag fixture.
- Packaged `.skill` ZIP integrity: passed.
