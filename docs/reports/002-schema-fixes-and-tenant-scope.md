# Task: Schema fixes and tenant foundation

## FR IDs

- FR-3 (depot data isolation): tenant context, tenant-aware Prisma access layer, cross-tenant unit tests.
- FR-26 (payments applied to invoices): `payment_allocations` schema supports one payment across several invoices; no payment behavior implemented yet.
- FR-7 (staff roles): single-role model with OWNER as a superset of SALES and STOCK_KEEPER is documented in the schema; guards are Phase 2.
- No user-facing feature behavior was built. FR-14, FR-39, FR-40, and FR-41 remain deferred and have no tables.

## Summary

Fixed the schema draft: documented the single-role/OWNER-superset decision and added `payment_allocations` while removing the direct `payments.sale_order_id` link. Generated the Prisma 7 client, added a `PrismaService` with a private base client and graceful shutdown, and implemented the token-only tenant context plus a tenant-aware Prisma extension with a separate platform-admin path. Added 19 cross-tenant/tenant-scope unit tests, a draft RLS SQL file, and removed `--passWithNoTests` from `test:tenant`.

No migrations were created or run. No earlier reports existed in `docs/reports/` at the start of this task.

## Files changed

- Schema: `apps/api/src/prisma/schema.prisma` (OWNER superset comments, `payment_allocations`, removed `payments.sale_order_id`)
- RLS draft: `apps/api/src/prisma/row-level-security.sql` (draft only, not applied)
- Prisma client/service: `apps/api/src/prisma/prisma.service.ts`, `apps/api/src/prisma/prisma.module.ts`
- Tenant layer: `apps/api/src/common/tenant/tenant-context.ts`, `tenant-models.ts`, `tenant-scope.ts`
- Env helper: `apps/api/src/common/config/env.ts`; `apps/api/src/main.ts` now loads env and enables shutdown hooks
- App wiring: `apps/api/src/app.module.ts` imports `PrismaModule`
- Tests: `apps/api/test/tenant-scope.tenant-spec.ts`, `apps/api/test/setup-env.cjs`; `apps/api/jest.config.cjs`, `apps/api/test/jest-tenant.config.cjs`
- Tooling: `apps/api/package.json` (prebuild/pretest/pretest:tenant generate steps, `test:tenant` without `--passWithNoTests`), `.github/workflows/ci.yml` (job-level `DATABASE_URL`), `README.md`
- Dependencies: added `@prisma/adapter-pg@7.10.1`, `pg@8.23.1`, dev `@types/pg@8.23.1`; moved `dotenv` from devDependencies to dependencies because the API loads `.env` at runtime. Reason: Prisma 7 requires a driver adapter, and the API now owns a database client.
- No changes to `AGENTS.md`, `docs/PRD.md`, or `docs/reports/001-*` (report 001 does not exist).

## Tests run

- `pnpm --filter api exec prisma format`: pass, schema formatted.
- `pnpm --filter api exec prisma validate`: pass, schema valid.
- `pnpm --filter api exec prisma generate`: pass, client generated into `apps/api/src/generated/prisma`.
- `pnpm format:check`: pass.
- `pnpm lint`: pass (api and web).
- `pnpm test`: pass. API: 2 suites / 20 tests (health e2e + tenant scope). Web: 1 suite / 2 tests.
- `pnpm --filter api test:tenant`: pass. 1 suite / 19 tests; no `--passWithNoTests` anymore.
- `pnpm build`: pass (Nest API and Next web).
- Runtime smoke: built API returned `200` for `GET /api/v1/health`.
- `docker info`: Docker daemon is not running on this machine.
- `docker compose config`: valid.
- No database-backed tests were run, and no migrations, RLS SQL, or seed scripts were applied. Docker being unavailable is the reason the extension was not exercised against PostgreSQL.

## Security check

- `TenantContext` has a private constructor and can only be built from token claims (`fromPrincipal`). It rejects platform admins, missing depot ids, empty user ids, and unknown roles at runtime.
- The tenant extension adds `depot_id` to `where` for reads, counts, aggregates, updates, and deletes, stamps it on creates, and rejects a caller-supplied depot id that differs from the token depot. Unknown operations fail closed.
- The base Prisma client is private to `PrismaService`. Normal access is `forTenant(context)`; the only cross-depot path is the explicit `forPlatformAdmin(principal)`, which asserts the platform admin role.
- Platform-level models (`Depot`, `Plan`, `Role`) are intentionally not tenant-scoped and are listed as such.
- 19 tenant tests include a depot A user trying to filter, create, or update depot B data and being rejected, plus context/platform-path role checks.
- RLS SQL is drafted for all 17 depot-owned tables and is explicitly not applied. It is defence-in-depth only, not relied on by the app.
- No new endpoints were added; the public health endpoint is unchanged.

## Open issues / risks

- The tenant extension does not rewrite nested writes (for example invoice lines created inside a sales order) or raw queries (`$queryRaw`, `$executeRaw`). Services must set `depot_id` explicitly on nested rows, stay inside one transaction, and avoid raw SQL. RLS is the second layer.
- The RLS draft is unverified: it was not applied or tested against PostgreSQL. It needs a dedicated non-owner application role, `SET LOCAL app.depot_id` per transaction, and a decision on `FORCE ROW LEVEL SECURITY` and the platform-admin bypass.
- Docker was not running, so no PostgreSQL integration test, migration, or RLS test was run.
- `payment_allocations` has no database constraint for "sum of allocations <= payment amount" or "amount > 0"; those are Phase 3 service rules. Payment deletion cascades allocations; invoice deletion is restricted.
- OWNER as a superset of SALES and STOCK_KEEPER is documented only. The permission hierarchy and role guards belong to Phase 2.
- The generated Prisma client is gitignored and rebuilt by `prebuild`/`pretest`/`pretest:tenant` or `prisma:generate`. Prisma CLI commands need `DATABASE_URL`; CI sets a dummy value.
- The local Node 26 install still shows Prisma's unsupported-version warning; Node 24 LTS remains the recommendation.
- No git repository exists here, so nothing was committed or pushed.

## Decisions needed from the human

1. Confirm the OWNER permission-superset approach for Phase 2 (permission map in code versus a database permission table).
2. Confirm the RLS direction: separate application role with `SET LOCAL app.depot_id` per transaction, and whether platform admin should use `BYPASSRLS`, a session flag, or a dedicated role.
3. Confirm that nested writes stay explicit (not auto-scoped by the tenant extension) until the sales/purchase modules are built.
4. Confirm payment allocation semantics: cascade allocations when a payment is deleted, restrict deletion of allocated invoices, and audit-log allocation edits.
5. Confirm whether the generated Prisma client should stay gitignored (current choice) or be committed.

## Status

ready for review

## Human review (filled in by the human only)
Decision: approved
Notes:
