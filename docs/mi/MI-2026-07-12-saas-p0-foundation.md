# SaaS P0 foundation

## Trigger / symptom

Public SaaS readiness audit found single-admin authentication, global service-role data access, no tenant ownership model, and known production dependency advisories.

## Scope inspected

- Root Next.js application and API routes
- Supabase clients and 17-table schema
- Instagram OAuth, webhook, publishing, and disconnect paths
- npm production dependency audit
- Test and production build baseline

## Commands run

```bash
npm audit --omit=dev
npm test -- --runInBand
npm run build
git worktree list
```

## Files inspected

- `middleware.js`
- `lib/supabase.js`
- `lib/supabase-server.js`
- `lib/supabase-schema*.sql`
- `lib/media.js`
- `app/api/instagram/*`
- `app/api/webhooks/instagram/route.js`
- `app/api/publish/*`
- `package.json`
- `package-lock.json`

## Findings

- Shared HTTP Basic Auth protects all interactive users.
- Root API routes use a global service-role client that bypasses RLS.
- Domain tables lack workspace ownership columns.
- Several account lookups select the first Instagram account globally.
- Disconnect route deletes every connected Instagram account.
- Production audit reported two high and one moderate advisory before remediation.
- React was installed at `19.2.0`, below the complete `19.2.4` RSC security patch line.
- Existing baseline passed 64 tests across 16 suites and completed a production build.

## Direct answers / conclusions

Highest-priority implementation must establish secure runtime dependencies, request authentication, and tenant/RLS schema before external users receive access.

## Proposed surgical fix

Parallel isolated worktrees:

- `codex/p0-deps`: dependency, proxy, and Next.js runtime baseline
- `codex/p0-auth`: Supabase SSR authentication shell
- `codex/p0-tenant`: additive workspace schema and RLS foundation

Main thread integrates commits, resolves dependency overlap, and runs full verification.

## Files changed

- Runtime: `package.json`, `package-lock.json`, `next.config.mjs`, `proxy.js`
- Auth: `lib/supabase-auth/*`, `app/login/*`, `app/auth/*`, `.env.example`
- Tenant schema: `lib/migrations/2026-07-12-tenant-workspace-foundation.sql`, migration runbook and contract test
- Redirect hardening: `lib/app-url.js` and tests
- UI/docs/tests: sidebar logout, auth styles, transition boundary, proxy/auth tests, this MI and index

## Validation status

Pre-change baseline:

- `npm test -- --runInBand`: pass, 16 suites / 64 tests
- `npm run build`: pass with middleware deprecation and workspace-root warnings
- `npm audit --omit=dev`: fail, two high / one moderate advisory

Combined P0 branch:

- `npm audit`: pass, zero known vulnerabilities
- `npm test -- --runInBand`: pass, 20 suites / 88 tests
- `npm run build`: pass on Next.js 16.2.10; 70 routes generated
- Middleware deprecation and workspace-root warnings eliminated
- SQL migration: seven static contract tests pass; not applied to production because explicit owner/workspace UUIDs and backup approval are required

## Current status / next steps

P0 foundation integrated locally. Before multi-user access:

1. Back up Supabase and apply reviewed tenant migration.
2. Bootstrap explicit owner/workspace UUIDs and backfill legacy rows.
3. Scope every service-role route read/write to resolved workspace/account.
4. Add route-level claim and membership authorization; proxy remains coarse defense only.
5. Set production `APP_URL`, create initial Supabase Auth user, then retire Basic Auth fallback.
