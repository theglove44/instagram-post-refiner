# Voice Workshop

Next.js app for refining Instagram captions into training data and tracking account
performance. Package name is `instagram-post-logger`, the brand is Tuck In and Talk —
all three refer to this one app.

`README.md` is the user guide. `docs/technical-reference.md` holds setup, hosting,
schema and the API surface. Trust the filesystem over both when they disagree.

---

## What the product actually is

The live product is small: **paste a topic and notes → AI writes a draft → the human
rewrites it → the pair is saved → the final text is copied into Google Keep, and
Michelle posts it by hand.** That's `/edit` and `/history`, plus settings.

Everything else — performance dashboards, publishing, scheduling, the comment and
mention inboxes — is **cold**. The code works and the routes respond, but the pages are
hidden from `Sidebar.js` and nobody uses them. Don't treat cold features as broken, and
don't polish them unasked.

## This app can still perform live actions

The cold code is not disabled, and the credentials in `.env` are production. There is no
staging Instagram account.

- `/api/publish/now` posts immediately to the real account. `/api/publish/schedule`
  posts later, unattended, if the scheduler timer is enabled.
- `/api/comments/reply` and `/api/comments/hide` change a public comment thread.
- `/api/instagram/disconnect` drops the OAuth token; re-authing is manual.

**Ask before running any of these, every time** — including "just to test it." Being
hidden from the nav makes this more dangerous, not less: nobody is watching those
features for unexpected activity.

---

## Where things live

| You need | Look in |
|---|---|
| Auth gate, route exemptions | `proxy.js` — the only entry point, not Next middleware |
| Session handling, JWT verification | `lib/supabase-auth/` |
| Graph API calls, token refresh, rate limiting | `lib/instagram.js` |
| Publish pipeline (container → poll → publish) | `lib/publishing.js` |
| Post ↔ Instagram matching, confidence scores | `lib/matching.js` |
| Engagement rates, percentiles, comparisons | `lib/derived-metrics.js` |
| Caption generation, voice pack | `lib/openai-caption.js`, `lib/voice-pack.js` |
| Training-data extraction | `lib/training-data.js` |
| Table definitions | `lib/supabase-schema*.sql`, `lib/migrations/` |
| Deploy, systemd units, timers | `deploy/` |

API routes are `app/api/**/route.js`, pages are `app/(app)/**/page.js`. Read the tree for
the current list rather than trusting a list written here.

---

## Constraints you cannot infer from the code

- **Cloudflare's proxy times out at 100 seconds.** This is why long operations
  (metrics refresh, import, matching) return `{ success: true, syncId, status: "running" }`
  immediately and process in the background, with the frontend polling
  `/api/instagram/health`. Never make one of these synchronous.
- **Meta allows ~200 Graph API calls per user per hour.** Metrics refresh costs 2 calls
  per post. Backfill is capped at 50 posts per batch. Never write a "process all records"
  endpoint without a batch cap and delays.
- **Supabase caps queries at 1000 rows by default.** Endpoints returning large sets use
  `.limit(5000)`. Anything that could exceed 5000 needs explicit pagination.
- **The service role key bypasses RLS**, and every API route uses it
  (`lib/supabase-server.js`). RLS is not protecting server-side code — the auth gate is.
  `lib/supabase.js` is the anon, browser-safe client.
- **Multi-tenancy is staged, not live.** The workspace schema and membership RLS exist in
  `lib/migrations/`, but routes still read and write as the service role and existing rows
  have no owner backfill. Don't write code that assumes a tenant context.
- **A Reel is `media_product_type = 'REELS'` OR `media_type = 'VIDEO'`** without a FEED
  product type. Everything else — images, carousels — is a Post.
- **`published_at` is the primary date** for all analytics and sorting, falling back to
  `created_at` only for posts not yet linked to Instagram.

## Auth chain

`proxy.js` gates every route, in this order. Changing the order changes who gets in:

1. `/api/webhooks/*` is **public** — Meta calls it server-to-server and cannot send
   credentials. POST is protected by HMAC-SHA256 signature verification instead.
2. A valid `x-cron-secret` header passes — used by systemd timers and internal cron calls.
3. `/login` and `/auth/callback` are open, or nobody could ever sign in.
4. Supabase Auth session, verified with `getClaims`. **`getSession` is not trusted** —
   it doesn't verify the JWT.
5. HTTP Basic against `ADMIN_USER`/`ADMIN_PASS` — a transitional fallback, to be removed
   once every operator has a Supabase Auth account. Don't build anything new on it.

## Data integrity

`ai_version` is the original AI draft and is **never modified after creation**.
`final_version` is the human edit. Both are preserved verbatim because the pair *is* the
training data — a migration that rewrites either destroys the product.
`edit_count` counts meaningful edits, where an add/remove pair counts as one.

---

## Testing loop

Run `npm test` before you claim anything works. Run `npm run build` too if you touched
routing, config, or imports — jsdom tests pass on code that fails the Next build.

Write the test first for anything in `lib/` or `app/api/`. A new API route means a new
`route.test.js` beside it, no exceptions.

**Never let a test reach a live service.** Instagram, Supabase and OpenAI are always
mocked. A test that publishes to a real account is a bug, not a slow test.

Copy the mocking pattern from `app/api/publish/now/route.test.js`:

- `jest.mock('@/lib/supabase-server')` with a chainable builder stub — `select`, `eq`,
  `limit` and `order` return the builder; `.single()` resolves.
- Stub `global.Response` in `beforeAll` and restore it in `afterAll`. Tests run in jsdom,
  which has no Next `Response.json`.
- Mock the lib the route calls (`executePublish`), not the HTTP layer.

UI changes: no Playwright. Drive the real app and screenshot it. Use real post text from
the database — Lorem ipsum hides the layout bugs that long Instagram captions cause.

Hit a failing test you didn't cause? Say so and stop. Don't delete it, don't skip it,
don't loosen the assertion to get to green.

---

## Conventions worth stating

- API routes answer `{ success: true, ... }` or `{ success: false, error: "message" }`.
- Styling is inline styles plus `app/globals.css` — no UI library. Dark theme,
  background `#0a0a0a`, cards `#141414`, accent `#e1306c`, success `#22c55e`,
  error `#ef4444`. Grid collapses to one column at 1024px.
- Secrets — hosting, SSH, Facebook app config — live in Claude's auto-memory and `.env`,
  never in committed code. `.env.example` lists what's required.

---

## Keeping this file current

This file is a **failure log, not a wishlist**. Every line exists because something went
wrong at least once, or because it is a decision that cannot be worked out from the code.

When you make a mistake, get corrected, or discover something about this repo that wasn't
written down:

1. Add one line to the failure log below, **in the imperative**, describing the correct
   behaviour.
2. Keep it specific to this repo. General advice belongs nowhere — you already know it.
3. If the fix is a **workflow rather than a rule**, put it in `.claude/skills/` and link
   it from here instead.
4. Tell me you added it. Don't edit this file silently.

One line per failure, not one paragraph.

### Failure log

- **Check `Sidebar.js` before calling a feature "live".** Most of this app is cold code
  reachable only by typing a URL. Both this file and the README once described the
  publishing pipeline and six analytics dashboards as if they were in daily use.
  (2026-08-14.)
- **Don't describe the file tree in here.** The previous version of this file listed every
  route, lib and dependency, went stale within weeks, and told the agent the auth
  middleware lived in a file that no longer exists. Point at the tree; don't copy it.
  (2026-08-14.)
- **Verify the auth path in `proxy.js` before changing anything about access.** There is no
  `middleware.js`; Basic Auth is a fallback, not the gate.
- **Never call a publishing, comment or account endpoint against the real account without
  asking first.** There is no staging account.
