# Task: Depot registration, approval, and authentication

## FR IDs

- FR-1: depot owner registers with depot name, owner name, phone, email, and password.
- FR-2: Platform Admin lists and approves, rejects, or suspends depots.
- FR-3: depot isolation is extended to the `depots` table and covered by cross-tenant tests.
- FR-6: email-or-phone login, JWT access and refresh tokens with role and depot claims.
- Audit entries added here are groundwork for FR-50/FR-51; the audit viewer itself is not built yet.

## Summary

Added public depot registration (PENDING), Platform Admin depot review endpoints, email/phone login
with bcrypt password hashes and JWT access/refresh tokens, global default-deny authentication and
permission guards, login lockout, per-IP rate limits, a Platform Admin seed script, and audit entries
for registration, approval/rejection/suspension, and successful logins.

The new migration seeds the five roles, makes `plans` and `roles` SELECT-only for the app role, adds
a `depots` RLS policy, and adds narrow `SECURITY DEFINER` auth lookup/bookkeeping functions. Pending,
rejected, and suspended depots cannot log in. Registration runs in a dedicated transaction whose
`app.depot_id` is the newly generated depot id, so it never receives a general cross-depot bypass.

## Files changed

Configuration and documentation:

- `.env.example`: Platform Admin seed variables (placeholders only).
- `.github/workflows/ci.yml`: dummy JWT secrets/TTLs for unit tests.
- `README.md`: auth/platform endpoints, seed command, Phase 2 status, updated grants/RLS notes.
- `apps/api/package.json`, `pnpm-lock.yaml`: added `@nestjs/jwt` and `bcryptjs`; removed the
  briefly-tested `@nestjs/throttler` because its ESM entry caused a Jest cycle, replacing it with the
  local rate-limit guard below.

Migration and data access:

- `apps/api/src/prisma/migrations/20261020100000_auth_and_depot_rls/migration.sql`: role seed,
  `plans`/`roles` SELECT-only grants, `depots` RLS, four auth functions and their grants.
- `apps/api/src/prisma/auth-repository.ts`: parameterized calls to the auth functions.
- `apps/api/src/prisma/prisma.service.ts`: `runForDepotRegistration`, auth lookup/bookkeeping methods.
- `apps/api/src/prisma/row-level-security.sql`: reference copy updated with the `depots` policy and
  read-only reference-table grants.
- `apps/api/src/common/tenant/tenant-context.ts`: `isUserRole` validation helper.

Auth and platform admin:

- `apps/api/src/app.module.ts`, `apps/api/src/main.ts`: global guards, global JWT module, shared app
  configuration.
- `apps/api/src/common/auth/permissions.ts`: code permission map; OWNER inherits SALES and
  STOCK_KEEPER permissions.
- `apps/api/src/common/auth/{jwt-auth.guard,permissions.guard,rate-limit.guard}.ts` and their
  decorators/types: default-deny auth, permission checks, in-memory per-IP rate limiting.
- `apps/api/src/common/{bootstrap/configure-app,filters/http-exception.filter}.ts`: shared prefix,
  validation, and `{ statusCode, error, message, details? }` error format.
- `apps/api/src/common/audit/audit-actions.ts`: shared audit action names.
- `apps/api/src/modules/auth/*`: registration, login, refresh, `/auth/me`, DTOs, bcrypt service,
  token service.
- `apps/api/src/modules/platform-admin/*`: list/get/approve/reject/suspend depot endpoints, DTOs.
- `apps/api/src/modules/health/health.controller.ts`: explicitly `@Public()`.
- `apps/api/scripts/seed-platform-admin.mjs`: env-driven, idempotent Platform Admin seed using the
  owner connection. No credentials are hard-coded or printed.

Tests:

- `apps/api/test/auth.db.tenant-spec.ts`: database-backed API tests for registration, approval,
  rejection, suspension, login, refresh, `/auth/me`, validation, unauthorized, forbidden role, and
  wrong-depot access.
- `apps/api/test/{auth.service,permissions,password.service,rate-limit.guard,token.service}.spec.ts`:
  unit tests.
- `apps/api/test/health.e2e-spec.ts`: uses the shared app configuration.
- `apps/api/test/tenant-isolation.db.tenant-spec.ts`: fixtures now use the platform-admin session
  because `depots` has RLS; existing isolation assertions remain.
- `apps/api/test/scripts/prepare-test-db.mjs`: re-applies SELECT-only grants on `plans` and `roles`
  after the blanket test grant.

## Tests run

- `pnpm --filter api prisma validate` — passed.
- `pnpm --filter api prisma migrate deploy` — applied
  `20261020100000_auth_and_depot_rls`; `prisma migrate status` reports all 3 migrations up to date
  (development database `smartdepo`).
- `pnpm format:check` — passed.
- `pnpm lint` — passed for API and web.
- `pnpm test` — API: 8 suites, 38 tests passed; web: 1 suite, 2 tests passed.
- `pnpm --filter api test:tenant` — 3 suites, 38 tests passed against `smartdepo_test`.
- `pnpm build` — API Nest build and web Next.js production build passed.
- `pnpm --filter api seed:platform-admin` — run twice; idempotent, same local dev admin id. A local
  login smoke check for that admin returned the PLATFORM_ADMIN role and no depot; tokens were not
  printed.
- SQL verification as `smartdepo_app`: `roles` SELECT = true, INSERT = false; `plans` SELECT = true,
  UPDATE = false; `depots` RLS = true with policy `depot_tenant_isolation`; five roles and four
  `auth_*` functions present.

## Security check

- Global `JwtAuthGuard` authenticates every route unless explicitly `@Public()`; global
  `PermissionsGuard` rejects routes with no declared permission and checks the role permission map.
- OWNER is a superset of SALES and STOCK_KEEPER in `ROLE_PERMISSIONS`.
- Registration, login, and refresh DTOs use `class-validator`; the global pipe has `whitelist` and
  `forbidNonWhitelisted`.
- Passwords use bcrypt (`bcryptjs`, cost 12 by default). Passwords, hashes, and tokens are never
  logged.
- Login is rate limited, records failed attempts, and locks for 15 minutes after 5 failures.
  Registration and refresh are also rate limited. The limiter skips requests when
  `NODE_ENV=test` so database tests stay deterministic.
- Login resolves a user through narrow `SECURITY DEFINER` functions (email/phone or id); the app role
  does not get a general cross-depot bypass. Execute is revoked from `PUBLIC` and granted only to
  `smartdepo_app`.
- Registration opens a transaction with `app.depot_id` set to the generated depot id; the `depots`
  and child-table RLS policies allow only that new depot.
- Pending, rejected, and suspended depots cannot log in. Platform Admin review endpoints are guarded
  by platform permissions, and the service also calls `runAsPlatformAdmin`, which asserts the role.
- Cross-tenant tests: a depot A owner receives 403 on Platform Admin endpoints including depot B's id;
  a tenant-scoped database query returns only depot A and its owner even though depot B exists.
- Audit entries are written for registration, approval, rejection, suspension, and successful login.
  Audit logs remain append-only at the database level.
- The Platform Admin seed script reads credentials only from environment variables and uses the owner
  connection for the RLS-protected `users` table.

## Open issues / risks

- Refresh tokens are stateless JWTs with no revocation store or rotation history. A refresh token
  remains usable until it expires unless the user/depot is disabled or no longer approved.
- Suspending a depot blocks new logins and refreshes, but an already-issued access token remains valid
  until its short TTL expires (15 minutes by default).
- The rate limiter is per API process and in memory. It is adequate for this semester project; a
  shared store would be needed across multiple instances.
- No auth UI or Khmer/English strings were added in this task, so i18n files are unchanged.
- Email/phone verification, password reset, and staff management remain later Phase 2 work (FR-7 to
  FR-9).
- The local development `.env` now contains an env-seeded Platform Admin email/password; they are
  fake local credentials and are not in this report. The human should change them if desired.
- Platform Admin `reject` currently accepts only PENDING depots; `approve` can restore a rejected or
  suspended depot to APPROVED. A suspended reason is recorded in the audit entry rather than in the
  `rejection_reason` column.
- `smartdepo_owner` still has `CREATEDB` (kept by human decision) and the `app.is_platform_admin`
  session flag remains the platform path.
- CI has no PostgreSQL service, so `test:tenant` remains a local gate; CI runs unit/API-light tests,
  lint, formatting, schema validation, and builds.
- No git repository exists here, so nothing was committed or pushed.

## Decisions needed from the human

1. Accept stateless refresh tokens for now, or require refresh-token storage and rotation in a follow-up?
2. Accept the 15-minute access-token window after suspension, or check user/depot status on every
   authenticated request?
3. Accept the in-memory per-process rate limiter for the semester project, or move it to a shared
   store before deployment?
4. Confirm whether `reject` should also apply to SUSPENDED depots (currently only PENDING), and
   whether suspension needs its own reason column instead of audit-only storage.

## Status

ready for review

## Human review (filled in by the human only)
   ## Human review (filled in by the human only)
   Decision: approved
   Notes: Approved after local checks. Accepted for now: stateless refresh tokens, the 15-minute access-token window after suspension, and the in-memory rate limiter.