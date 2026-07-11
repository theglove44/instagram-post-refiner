# MI-2026-07-11: OAuth feedback and UX shell

## Trigger / symptom

Instagram OAuth success and failure returned to the home route, separate from the Settings connection UI. Navigation used six product taxonomies, editor wording was Claude-specific, the editor used a hidden disabled input for spacing, and several icon controls lacked accessible names.

## Scope inspected

- Instagram OAuth callback redirects only; no token, identity, analysis, or publishing-state changes
- App shell navigation and route boundaries
- Primary refine editor and caption editor controls
- Settings callback feedback
- Shared CSS contrast and motion behavior

## Commands run

```bash
rg --files -g 'AGENTS.md' -g '!node_modules' -g '!tuckinandtalk/**'
git status --short --branch
npm ci
npm test -- --runInBand
npm run build
npm start -- --hostname 127.0.0.1 --port 3104
git diff --check
```

## Files inspected

- `app/api/instagram/callback/route.js`
- `app/(app)/settings/page.js`
- `app/(app)/edit/page.js`
- `app/(app)/compose/page.js`
- `app/(app)/layout.js`
- `app/components/Sidebar.js`
- `app/components/CaptionEditor.js`
- `app/globals.css`
- Jest configuration and existing layout test

## Findings

- Callback query feedback landed on `/`, while connection status and retry controls live on `/settings`.
- Existing query parameters already provided a durable, refresh-preserved feedback channel; Settings did not render them.
- All routes fit a four-stage model: Refine, Publish, Measure, Learn. Settings is a shell utility.
- Primary editor fields lacked explicit textarea labels and used an invisible form group to align columns.
- Sidebar collapse and mobile overlay controls, compose tool icons, and hashtag removal icons needed accessible names.
- `--text-muted` and `--text-dim` were too dark on primary card surfaces.
- No shared `(app)` loading or error route boundary existed.

## Direct answers / conclusions

- Preserve OAuth outcome in URL query parameters and return directly to Settings.
- Keep every route; reorganize only sidebar labels and grouping.
- Use AI-neutral copy without changing persisted `aiVersion` data contracts.
- Use native labels and layout structure instead of hidden form controls.

## Proposed surgical fix

1. Redirect every OAuth callback outcome to `/settings` with existing encoded feedback parameters.
2. Render persistent success/error feedback from the Settings URL.
3. Collapse sidebar taxonomy into Refine, Publish, Measure, Learn; keep Settings as utility link.
4. Add editor labels, accessible icon-control names, improved contrast, reduced-motion overrides, and shared route states.
5. Add focused regression tests.

## Files changed

- OAuth: `app/api/instagram/callback/route.js` and test
- Settings: `app/(app)/settings/page.js` and test
- Shell: `app/components/Sidebar.js` and test
- Editors: `app/(app)/edit/page.js`, `app/components/CaptionEditor.js`, `app/(app)/compose/page.js`, and tests
- Route states: `app/(app)/loading.js`, `app/(app)/error.js`
- Styles: `app/globals.css`
- MI: this file and `docs/mi/README.md`

## Validation status

- Initial test run could not start because dependencies were absent.
- After `npm ci`, first regression run exposed two test-harness issues; both tests were corrected without production-code changes.
- Final Jest suite: passed.
- Next.js production build: passed; existing workspace-root and middleware deprecation warnings remain.
- Production server: started successfully.
- Browser screenshot: not captured because both available browser surfaces blocked localhost with `ERR_BLOCKED_BY_CLIENT`.
- Live Meta OAuth: not run because external credentials/account authorization were unavailable.
- `npm ci` reported five dependency audit findings (one low, two moderate, two high); dependencies were not changed in this workstream.

## Current status / next steps

Implementation complete and locally validated. External OAuth round-trip and visual screenshot remain integration-environment checks.
