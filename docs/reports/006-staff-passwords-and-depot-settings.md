# Task: Staff management, passwords, depot settings, and auth hardening

## FR IDs

- FR-7: owner creates, edits, and deactivates staff and assigns roles.
- FR-8: users change their own password; the owner resets staff passwords.
- FR-9: login rate limiting and lockout already existed; this task keeps them and clears the lockout on a password change or reset.
- FR-10: depot settings (name, address, currency, default language, invoice footer) with owner-only updates.
- FR-4 (plan limits part): staff creation and reactivation respect the active plan's `maxUsers` limit.
- FR-2 follow-up: rejection and suspension reasons are stored in `depots.status_reason`; rejection now applies only to PENDING depots, as decided by the human.
- FR-50 groundwork: audit entries for staff created/edited/deactivated, password changed/reset, and settings updated.

## Summary

Added the `users` module for owner-only staff management (list, create, edit, deactivate, reset password), a self-service `POST /auth/change-password`, and the `depots` module for depot settings read/update. Staff roles are limited to SALES, STOCK_KEEPER, and DELIVERY; OWNER and PLATFORM_ADMIN cannot be created or managed through these endpoints. Staff creation and reactivation enforce the active subscription plan's `maxUsers` limit with a clear `PLAN_USER_LIMIT_REACHED` error.

A new migration replaces `depots.rejection_reason` with `depots.status_reason` (copying existing values), adds `users.must_change_password`, ensures the four depot settings columns exist, and re-creates the two auth lookup functions with `must_change_password` in their result. All four `auth_*` SECURITY DEFINER functions keep a pinned `search_path` (`pg_catalog`), which was verified in the database after the migration. Platform Admin reject now accepts only PENDING depots and stores its reason in `status_reason`; suspend stores its reason there too.

## Files changed

Migration, schema, and data access:

- `apps/api/src/prisma/migrations/20261020120000_staff_passwords_and_settings/migration.sql` (new).
- `apps/api/src/prisma/schema.prisma`: `Depot.statusReason` (`status_reason`), `User.mustChangePassword` (`must_change_password`).
- `apps/api/src/prisma/auth-repository.ts`: `mustChangePassword` in the auth record and lookup columns.

Auth, staff, and settings:

- `apps/api/src/modules/auth/auth.service.ts`: `mustChangePassword` in login/`me`, `changePassword` for depot users and the platform admin.
- `apps/api/src/modules/auth/auth.controller.ts`, `auth.module.ts`, `dto/auth-response.dto.ts`, `dto/change-password.dto.ts` (new).
- `apps/api/src/modules/auth/dto/register-depot.dto.ts`: uses the shared password rules.
- `apps/api/src/common/validation/password.ts` (new), `transforms.ts` (new), `prisma/prisma-errors.ts` (new).
- `apps/api/src/modules/users/*` (new): controller, service, module, staff role constants, create/update/reset/list/staff-view DTOs.
- `apps/api/src/modules/depots/*` (new): depot settings controller, service, module, and DTOs.
- `apps/api/src/common/auth/permissions.ts`: `PASSWORD_CHANGE` for every role, `USERS_MANAGE` for OWNER only.
- `apps/api/src/common/audit/audit-actions.ts`: staff, password, and settings actions.
- `apps/api/src/app.module.ts`: registers `UsersModule` and `DepotsModule`.

Platform admin:

- `apps/api/src/modules/platform-admin/platform-admin.service.ts`: `statusReason` for reject/suspend; reject only PENDING.
- `apps/api/src/modules/platform-admin/dto/depot-admin-view.dto.ts`: `statusReason` schema.
- `apps/web/src/lib/types.ts`: `DepotAdminView.statusReason` (type-only rename; no UI text).

Documentation:

- `README.md`: endpoint table, staff/password/settings behavior, migration and phase status.
- `.env.example`: unchanged; no new environment variables.

Tests:

- `apps/api/test/users.service.spec.ts` (new), `depot-settings.service.spec.ts` (new).
- `apps/api/test/auth.service.spec.ts`, `permissions.spec.ts`: new password, must-change, and permission cases.
- `apps/api/test/staff.db.tenant-spec.ts` (new): database-backed staff/password/settings API tests.
- `apps/api/test/support/owner-database.ts` (new): owner connection for the read-only `plans` plan-limit fixture.
- `apps/api/test/auth.db.tenant-spec.ts`: `statusReason`, `mustChangePassword`, new OpenAPI paths, reject-non-pending test.

## Tests run

- `pnpm format:check` — passed ("All matched files use Prettier code style").
- `pnpm lint` — passed for API and web.
- `pnpm test` — passed: API 11 suites / 65 tests; web 5 suites / 18 tests.
- `pnpm --filter api test:tenant` — passed: test database rebuilt and migrated (21 tables); 4 suites / 60 tests.
- `pnpm build` — passed: NestJS API and Next.js production build (14 routes).
- `pnpm --filter api exec prisma validate` — passed.
- `pnpm --filter api prisma:generate` — passed.
- `pnpm --filter api exec prisma migrate deploy` — applied `20261020120000_staff_passwords_and_settings` to `smartdepo`; all 4 migrations up to date.

Database verification after the migration (app role, development database):

- `depots` has `address`, `currency`, `locale`, `invoice_footer`, and `status_reason`; `rejection_reason` is gone.
- `users.must_change_password` is `boolean NOT NULL DEFAULT false`.
- All four `auth_*` functions are `SECURITY DEFINER`, owned by `smartdepo_owner`, and have `proconfig = {search_path=pg_catalog}`; only `smartdepo_app` has EXECUTE.

An intermediate `test:tenant` run failed because the new suite's generated phone numbers collided with the auth suite running in parallel. The helper was changed to derive a per-run numeric suffix; all later runs passed. No test was run against the development database.

## Security check

- `GET/POST/PATCH /users*` and `PATCH /depot/settings` are OWNER-only through `USERS_MANAGE` / `DEPOT_MANAGE`; `GET /depot/settings` is the existing `DEPOT_READ` granted to every depot role. `POST /auth/change-password` uses `PASSWORD_CHANGE` for every role.
- The depot always comes from the access token. Staff lookups are `id + depot_id`; another depot's staff id returns 404 on edit, deactivate, and reset. A `depotId` in a request body is rejected by the whitelist pipe (400) and has a test.
- Staff endpoints refuse OWNER and PLATFORM_ADMIN targets (403), cannot create those roles (400), and self-deactivation is refused.
- Deactivated staff cannot log in or refresh (database test proves both). Password change requires the current password and rejects an unchanged password; reset sets `must_change_password`, clears the lockout, and returns it in the login response and `/auth/me`.
- Audit entries are written for staff created/edited/deactivated, password changed, password reset, and settings updated. Tests assert the audit payload contains no password or hash.
- Plan user limits count active users only and are checked inside the same tenant transaction as staff creation/reactivation.
- Cross-tenant and role tests are database-backed against `smartdepo_test` only; fixtures that need the read-only `plans` table use the guarded owner test connection.
- Raw SQL remains confined to `apps/api/src/prisma/**`; password hashes and tokens are never logged or returned.
- The migration keeps every `auth_*` function on a pinned `search_path` and re-applies the narrow EXECUTE grant after recreating the lookup functions.

## Open issues / risks

- Report numbering collision: `docs/reports/006-swagger-api-docs.md` already exists. This report uses the filename the human explicitly requested; one of the two 006 files should be renumbered.
- Deactivation and suspension block login and refresh immediately, but an already-issued access token stays valid until its short TTL (15 minutes by default), because refresh tokens are stateless by decision.
- The plan user limit is checked in a transaction but not serialized; two simultaneous staff creations could exceed `maxUsers` by one. A unique constraint or row lock would close this.
- Depots with no active subscription are not limited, because plan assignment (Platform Admin side of FR-4) is not built yet. If every depot should have a default plan, that needs a product decision.
- `must_change_password` is returned to the client but does not block other endpoints. The task required telling the client; enforcing a forced-change gate everywhere would be a separate behavior change.
- There is no staff/settings UI or Khmer/English text in this task; it is backend-only. `km.json` and `en.json` are unchanged.
- The platform admin can change its own password through the same endpoint, but its audit entry has no depot (depot-level audit viewer does not exist yet).
- The migration drops `depots.rejection_reason` after copying values; any external report or SQL that still reads that column must be updated.
- No Playwright/e2e flow was added for staff or settings; API tests cover the feature paths against PostgreSQL.

## Decisions needed from the human

1. How to resolve the duplicate `006` report number (`006-swagger-api-docs.md` vs this file)?
2. Should `must_change_password` block other API actions until the password is changed, or stay a client-side prompt?
3. Should depots without an active subscription be unlimited until plan assignment exists, or get a default plan automatically?
4. Is the 15-minute access-token window after deactivation acceptable, or is token revocation needed before the demo?

## Status

ready for review

## Human review (filled in by the human only)
   ## Human review (filled in by the human only)
   Decision: approved
