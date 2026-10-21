# Task: First migration, row-level security, and database-backed tenant tests

## FR IDs

- FR-3 (depot data isolation): applied RLS, tenant-scoped transactions, and cross-tenant tests that run against PostgreSQL.
- FR-26 (payments applied to invoices): positive-amount CHECK constraints on `payments` and `payment_allocations`; payment behavior is still Phase 3.
- FR-50 / FR-51 (audit log): database-level append-only policies on `audit_logs`; the audit-log module itself is Phase 5.
- No user-facing feature behavior was added.

## Summary

Created and applied the initial Prisma migration plus a separate RLS migration for all 17 depot-owned tables. The app role is not the table owner and has no `BYPASSRLS`, so the policies apply; `PrismaService.runAsTenant` now opens a transaction and sets `app.depot_id` with `set_config(..., true)`, while the platform-admin path sets `app.is_platform_admin`. Added database-backed tests that prove depot A cannot read, update, or delete depot B rows with and without the Prisma extension, and banned raw SQL outside `src/prisma` with ESLint.

The local PostgreSQL setup described in `AGENTS.md` did not exist (no `smartdepo_owner` / `smartdepo_app`, no `smartdepo_test`, no owner/test URLs). After asking, the human approved provisioning it. The database was reachable throughout.

## Files changed

- Migrations:
  - `apps/api/src/prisma/migrations/migration_lock.toml`
  - `apps/api/src/prisma/migrations/20261020074650_init/migration.sql` (schema, positive-amount CHECK constraints)
  - `apps/api/src/prisma/migrations/20261020075000_row_level_security/migration.sql` (RLS policies, audit append-only policies, grant documentation)
- RLS reference: `apps/api/src/prisma/row-level-security.sql` (updated to match the applied migration; marked as reference copy)
- Database access:
  - `apps/api/src/prisma/prisma.service.ts` (`runAsTenant`, `runAsPlatformAdmin`, transactional session setup)
  - `apps/api/src/prisma/tenant-session.ts` (new; parameterized `set_config` helpers)
  - `apps/api/src/common/tenant/tenant-scope.ts` (transaction client type, comment update)
  - `apps/api/prisma.config.ts` (Prisma CLI uses `MIGRATION_DATABASE_URL`)
  - `apps/api/src/common/config/env.ts` (quiet dotenv)
- Tests and tooling:
  - `apps/api/test/tenant-isolation.db.tenant-spec.ts` (new; 5 database-backed tests)
  - `apps/api/test/test-database.guard.spec.ts` (new; 3 guard tests)
  - `apps/api/test/support/test-database.ts` (new; `_test` guard and client factory)
  - `apps/api/test/scripts/prepare-test-db.mjs` (new; guarded test-schema reset, migrations, grants)
  - `apps/api/test/setup-env.cjs` (loads root `.env`)
  - `apps/api/jest.config.cjs` (excludes DB tests from `pnpm test`)
  - `apps/api/test/jest-tenant.config.cjs` unchanged
  - `apps/api/package.json` (`db:test:prepare`, `test:tenant` prepares the database first)
  - `apps/api/eslint.config.mjs` (raw-SQL ban outside `src/prisma/**`, `.mjs` globals)
- Configuration/docs: `.env.example` (three database URLs), `.github/workflows/ci.yml` (`MIGRATION_DATABASE_URL` for Prisma CLI), `README.md` (roles, grants, test setup, current architecture)
- Local only, gitignored: `.env` (real generated local passwords; not printed or written to this report), local PostgreSQL roles/databases and grants
- No changes to `AGENTS.md`, `docs/PRD.md`, or previous reports.

## Tests run

- `pnpm --filter api exec prisma validate`: pass, schema valid.
- `pnpm --filter api prisma:generate`: pass, client generated.
- `pnpm --filter api exec prisma migrate deploy`: pass; `20261020074650_init` and `20261020075000_row_level_security` applied to `smartdepo`.
- `pnpm --filter api exec prisma migrate status`: pass, database schema up to date.
- `pnpm format:check`: pass.
- `pnpm lint`: pass (api and web).
- `pnpm test`: pass. API: 3 suites / 23 tests (health e2e, tenant unit tests, test-database guard). Web: 1 suite / 2 tests.
- `pnpm --filter api test:tenant`: pass. 2 suites / 24 tests: 19 DB-free tenant tests plus 5 database-backed isolation tests. The script reset and migrated `smartdepo_test` first.
- `pnpm build`: pass (Nest API and Next web).
- Runtime smoke: built API returned `200` for `GET /api/v1/health`.
- Database verification (development DB): 17 tables have RLS enabled, 19 policies exist (17 tenant + 2 audit append-only), and both positive-amount CHECK constraints are present.
- `prisma migrate reset` was not used; Prisma 7 refuses it for AI agents. The guarded test script resets only the `public` schema of `smartdepo_test` with `pg`, then uses `prisma migrate deploy`.
- No test was run against the development database; the guard unit tests prove the `_test` refusal.

## Security check

- `smartdepo_app` is not a superuser, has no `BYPASSRLS`, and is not the table owner, so RLS applies to the API.
- RLS is enabled on all 17 depot-owned tables. Policies deny by default when `app.depot_id` is unset; tests confirm a query outside a tenant transaction returns zero rows.
- `PrismaService.runAsTenant` applies the Prisma extension and sets `app.depot_id` inside the same interactive transaction. `runAsPlatformAdmin` asserts `PLATFORM_ADMIN` and sets `app.is_platform_admin` in the transaction; no `BYPASSRLS` connection is used.
- Cross-tenant tests use the app role and cover read, update, and delete of depot B rows from depot A, both with the extension and with a plain Prisma client (RLS alone). They also confirm the depot B row is unchanged afterwards.
- `audit_logs` has restrictive `UPDATE`/`DELETE` policies that deny those operations, enforcing append-only behavior at the database layer.
- ESLint bans `$queryRaw*` and `$executeRaw*` outside `apps/api/src/prisma/**`; the tenant session helper uses a tagged template, so the depot id is parameterized. The rule was verified with a temporary file (since removed).
- Test database access refuses URLs whose database name does not end with `_test`, both in the preparation script and in the test client helper.
- No new endpoints were added. No secrets were printed or added to documents.

## Open issues / risks

- `smartdepo_owner` was granted `CREATEDB` because `prisma migrate dev` creates a shadow database. It remains a non-superuser without `BYPASSRLS`. `prisma migrate deploy` (used by the test script and CI) does not require it. A dedicated shadow-database URL is an alternative.
- `depots`, `plans`, and `roles` are global tables without RLS. They are intended to be reachable only through platform-admin endpoints, but the app role currently has table grants on them (needed for depot registration and platform work). Platform endpoints do not exist yet.
- The platform-admin bypass trusts the transaction-local `app.is_platform_admin` flag. A successful SQL injection using the app role could set it, which is why raw SQL is lint-banned and confined. A dedicated role with `BYPASSRLS` is an alternative for deployment.
- The Prisma extension still does not rewrite nested writes or raw SQL. RLS constrains direct rows, but services must set `depot_id` explicitly on nested child rows and stay inside one transaction.
- The test preparation script drops and recreates the `public` schema in `smartdepo_test` directly. This is guarded by the `_test` check and never touches `smartdepo`; it was chosen because Prisma 7 blocks `migrate reset` for AI agents.
- The test database preparation re-applies grants after migrations. Development tables rely on the default privileges configured during provisioning; if the `public` schema is ever recreated in development, grants must be re-applied.
- CI has no PostgreSQL service, so `test:tenant` runs locally only; CI still runs `pnpm test`, which excludes the database-backed suite.
- `.env` now contains generated local passwords for the two roles. It is gitignored; the human may rotate the passwords.
- No git repository exists here, so nothing was committed or pushed.

## Decisions needed from the human

1. Keep `CREATEDB` on `smartdepo_owner` for `migrate dev`, or provide a dedicated shadow-database URL?
2. Add RLS/policies for the global tables (`depots`, `plans`, `roles`) now, or wait for the platform-admin module?
3. Keep the `app.is_platform_admin` session flag for platform admin, or move platform work to a separate `BYPASSRLS` role for deployment?
4. Accept the guarded direct schema reset in `test:tenant`, or replace it with a CI service database and `migrate deploy` only?

## Status

ready for review

## Human review (filled in by the human only)
Decision: approved
Notes:
