# SmartDepo progress

Last updated: 2026-10-20

This file is a working progress log. It is not the formal task report and it does not replace
`docs/reports/`. Formal reports remain the source of truth for review status.

## Completed work

### Tasks 001-004 (foundation, schema, tenant scope, registration and auth)

- Set up the pnpm workspace, TypeScript, NestJS API, Next.js web app, lint, Prettier, and Jest.
- Added the Prisma schema for plans, depots, subscriptions, roles, users, products, units, prices,
  batches, stock movements, customers, sales, payments, allocations, suppliers, purchases, and
  audit logs.
- Added the initial migration and PostgreSQL row-level security for every depot-owned table.
- Added the token-only tenant context, the tenant-aware Prisma extension, and cross-tenant tests.
- Implemented depot registration, JWT login/refresh, role guards, login rate limiting, and
  Platform Admin approve/reject/suspend endpoints.
- Added narrow `SECURITY DEFINER` auth functions for login lookups and login bookkeeping.
- Reports saved as `docs/reports/002-schema-fixes-and-tenant-scope.md`,
  `docs/reports/003-first-migration-and-rls.md`, and
  `docs/reports/004-depot-registration-and-auth.md`.

Note: `docs/reports/001-*.md` does not exist in the repository. Earlier reports state that no
earlier report was present when they were written.

### Task 005 (frontend foundation and auth screens)

- Added the Next.js app shell and Khmer/English i18n.
- Added registration, login, pending, rejected, and suspended screens.
- Added the Zustand session store. The access token stays in memory; the refresh token is stored in
  an httpOnly, SameSite=Lax cookie set by Next.js route handlers under `/api/auth`.
- Added same-origin `/api/v1/*` proxying to the Nest API.
- Added role-aware navigation and client route guards.
- Added the Platform Admin depot list with approve, reject, and suspend confirmation dialogs.
- Added responsive layouts, loading states, empty states, and one Playwright registration and
  approval flow.
- Added additive backend auth details for blocked depots and duplicate registration identifiers.
- Report saved as `docs/reports/005-frontend-auth-and-shell.md` with status ready for review.

### Task 006A (Swagger/OpenAPI documentation)

- Added Swagger/OpenAPI documentation for health, auth, and Platform Admin endpoints.
- Added bearer authentication and response schemas.
- Swagger UI is available at `/api/docs`, with JSON at `/api/docs-json` and YAML at
  `/api/docs-yaml`.
- Swagger is enabled outside production. In production it requires `SWAGGER_ENABLED=true`.
- Verified the Swagger UI in Chromium with 10 operations, an Authorize button, no console errors,
  and Helmet security headers.
- Report saved as `docs/reports/006-swagger-api-docs.md` with status ready for review.

### Verification already run for Tasks 005 and 006A

- `pnpm format:check` passed.
- `pnpm lint` passed.
- `pnpm test` passed: API 9 suites and 41 tests, web 5 suites and 18 tests.
- `pnpm --filter api test:tenant` passed: 3 suites and 39 tests.
- `pnpm build` passed.
- `pnpm --filter web test:e2e` passed: 1 test.
- `pnpm install --frozen-lockfile` passed.

### Verification before the first git push

- `pnpm format:check` passed.
- `pnpm lint` passed.
- `pnpm test` passed: API 9 suites and 41 tests, web 5 suites and 18 tests.
- `pnpm --filter api test:tenant` passed: 3 suites and 39 tests against `smartdepo_test`.
- `pnpm build` passed for both the API and the web app.

### Git repository and GitHub

- Initialised a git repository on branch `main`.
- Added remote `origin` as `https://github.com/saratnarak/smartDepo.git`.
- Added `test-results/` and `playwright-report/` to `.gitignore` so generated Playwright output is
  not committed.
- Confirmed `.env` is ignored and only `.env.example` is tracked.
- Created the root commit `7c2db45 Initial SmartDepo implementation` with 153 files.
- Pushed `main` to `origin/main`. The remote branch now points at commit `7c2db45`.

## UI update: low border radii

- Changed the shared radius tokens so every UI radius resolves to either `5px` or `10px`.
- Replaced pill-shaped controls (`999px`), circular avatars/badges/spinners, and one-off values
  (`2px`, `6px`, `11px`, `12px`, `13px`, `20px`) with the shared radius variables.
- Small controls, badges, tabs, nav items, inputs, and panels use `5px`; cards, dialogs, avatars,
  status marks, and larger containers use `10px`.
- `pnpm format:check`, `pnpm lint`, `pnpm --filter web test`, and `pnpm --filter web build` passed.
- This change is uncommitted.

## In progress: Task 006B (staff, passwords, depot settings, auth hardening)

Target FRs: FR-7, FR-8, FR-9, FR-10, and the plan user-limit part of FR-4.

Human decisions for this task:

- Stateless refresh tokens and the in-memory login rate limiter stay for now.
- Rejection applies only to PENDING depots.
- Rejection and suspension reasons move to a new `depots.status_reason` column.
- Formal report must be `docs/reports/006-staff-passwords-and-depot-settings.md` with the human
  review decision left pending.

### Investigation completed

- Read `AGENTS.md` and the existing reports. Reports 002, 003, 004, 005, and
  `006-swagger-api-docs.md` exist; report 001 does not.
- Read the PRD requirements for FR-4, FR-7, FR-8, FR-9, and FR-10.
- Inspected the Prisma schema, all migrations, auth service and repository, tenant context and
  tenant scope, permissions map, Platform Admin service, DTOs, and existing tests.
- Confirmed the schema already has depot settings columns: `address`, `currency`, `locale`
  (default language), and `invoice_footer`. They do not need to be added again.
- Confirmed the existing reject/suspend column is `depots.rejection_reason`; it needs to be copied
  to `depots.status_reason` and replaced in the API.
- Confirmed `users` has no `must_change_password` column yet.
- Confirmed all four `auth_*` SECURITY DEFINER functions already have a pinned
  `SET search_path = pg_catalog`. The new migration should preserve that secure setting. No search
  path fix is required.
- Confirmed login already rejects inactive users, and refresh also rejects inactive users. This part
  of deactivation is already covered.
- Confirmed `Subscription` is tenant-scoped and `Plan` is platform-level. Plan user limits can be
  enforced by reading the depot's active subscription inside a tenant transaction.
- Confirmed no staff, password-change, or depot-settings endpoints exist yet.

### Report numbering issue found

- The Swagger work already uses `docs/reports/006-swagger-api-docs.md`.
- The human explicitly requested the new staff/password/settings report at
  `docs/reports/006-staff-passwords-and-depot-settings.md`.
- Nothing has been renamed or overwritten yet. This needs a decision or an explicit numbering
  resolution before the new report is saved.

### Task 006B work started before the stop request

- Created the empty migration directory
  `apps/api/src/prisma/migrations/20261020120000_staff_passwords_and_settings/`.
- Updated `apps/api/src/prisma/schema.prisma`:
  - replaced `Depot.rejectionReason` (`rejection_reason`) with `Depot.statusReason`
    (`status_reason`);
  - added `User.mustChangePassword` (`must_change_password`, default `false`).
- Created empty folders for the planned `users` and `depots` API modules and a shared validation
  helper.
- No migration SQL has been written yet.
- No service, controller, DTO, test, or report code has been written yet.
- The schema changes have not been generated into the Prisma client, migrated, linted, tested, or
  built.

### Partial Task 006B work reverted before the first git commit

- The two schema edits were reverted, the empty migration/module folders were removed, and the
  repository was returned to the last complete Task 005/006A state.
- This was done so the first pushed commit builds and passes CI. It does not mark Task 006B as done
  or change its plan.

### Planned Task 006B work

1. Add a migration that:
   - adds `depots.status_reason` and copies existing `rejection_reason` values into it;
   - adds `users.must_change_password boolean not null default false`;
   - verifies the depot settings columns and the four auth-function search paths;
   - updates the auth lookup functions to return `must_change_password`.
2. Update the schema and generated Prisma client.
3. Update Platform Admin reject/suspend flows to store and return `statusReason`.
4. Add OWNER-only staff management:
   - list with pagination/filtering/sorting;
   - create with allowed roles SALES, STOCK_KEEPER, DELIVERY;
   - edit staff details and role;
   - deactivate staff, with self-deactivation blocked;
   - enforce the active subscription's `maxUsers` limit.
5. Add password endpoints:
   - self password change with current-password verification;
   - OWNER password reset for staff with `mustChangePassword = true`;
   - return `mustChangePassword` in login and current-user responses.
6. Add depot settings read and update endpoints:
   - all depot roles can read the display settings they need;
   - OWNER only can update name, address, currency, default language, and invoice footer.
7. Add audit entries for staff create/edit/deactivate, password change/reset, and settings changes.
   Never log passwords.
8. Add unit tests, API tests, and database-backed tenant tests.
9. Run `pnpm format:check`, `pnpm lint`, `pnpm test`, `pnpm --filter api test:tenant`, and
   `pnpm build`.
10. Save the formal report and finish with "ready for review".

## Development servers

The web app and API were running for inspection:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- Swagger UI: `http://localhost:3001/api/docs`

They were stopped on request. Ports 3000 and 3001 were checked afterwards and no listeners remain.

## Repository status

- The working directory is not a git repository.
- Nothing has been committed or pushed.
- Tasks 005 and 006A are waiting for human review.
- The local development database contains fake verification depots from earlier testing; it was
  not reset.
