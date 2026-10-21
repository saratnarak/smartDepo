# Task: Subscription plans and the audit log API

## FR IDs

- FR-4: subscription plans (Free Trial, Basic, Pro) with limits on users and products; the billing is
  simulated.
- FR-50: the audit log of every change of a depot.
- FR-51: the owner can read and filter the audit log, and the log cannot be edited or deleted.

## Summary

Added the plans and the audit log to the API. The migration fills the `plans` table with the three
plans, gives every depot that had no plan the Free Trial, and the registration gives a new depot the
Free Trial as well. The limits of the plan are enforced: creating a staff account or a product of a
depot that reached the limit of its plan fails with a 409 and a clear reason
(`PLAN_USER_LIMIT_REACHED` or `PLAN_PRODUCT_LIMIT_REACHED`). The owner reads the plan of the depot
with the usage against the limits, the Platform Admin lists the plans and moves a depot to another
plan, and every plan change is written to the audit log of the depot.

The audit log got its own endpoints: the owner reads the log of the depot with filters for the
action, the user, the type of record, and the period, with sorting and paging; the Platform Admin
reads the entries of the platform. The log stays append-only: there is no endpoint to change or to
remove an entry, and the database refuses an update and a delete even for the Platform Admin. Every
JSON value of an entry is cleaned before it is shown, so a password hash, a token, or a secret can
never reach the client, even if an older entry holds one.

## Files changed

New:

- `apps/api/src/prisma/migrations/20261023120000_plans_and_audit_log/migration.sql`: the three plans
  and the Free Trial subscription of every depot that has no plan.
- `apps/api/src/common/plans/plan-limits.ts`: the plan of a depot and the two limit checks that the
  users service and the products service use.
- `apps/api/src/modules/plans/plans.module.ts`: the module of the plans.
- `apps/api/src/modules/plans/plans.service.ts`: the plans of the platform, the plan of the depot with
  the usage, and the change of the plan of a depot.
- `apps/api/src/modules/plans/depot-plan.controller.ts`: `GET /api/v1/depot/plan` (owner).
- `apps/api/src/modules/plans/platform-plans.controller.ts`: `GET /api/v1/platform/plans` and
  `PATCH /api/v1/platform/zdepots/:id/plan` (Platform Admin).
- `apps/api/src/modules/plans/dto/plan-view.dto.ts` and `dto/change-plan.dto.ts`: the Swagger classes
  and the body of the plan change.
- `apps/api/src/modules/audit-log/audit-log.module.ts`: the module of the audit log.
- `apps/api/src/modules/audit-log/audit-log.service.ts`: the list of the depot and the list of the
  platform.
- `apps/api/src/modules/audit-log/audit-log.controller.ts`: `GET /api/v1/audit-log` (owner).
- `apps/api/src/modules/audit-log/platform-audit-log.controller.ts`:
  `GET /api/v1/platform/audit-log` (Platform Admin).
- `apps/api/src/modules/audit-log/audit-sanitizer.ts`: the cleaner of the JSON values of an entry.
- `apps/api/src/modules/audit-log/dto/list-audit-log-query.dto.ts` and `dto/audit-log-view.dto.ts`: the
  filters and the Swagger classes.
- `apps/api/test/audit-sanitizer.spec.ts`: the unit tests of the cleaner.
- `apps/api/test/plans-audit.db.tenant-spec.ts`: the API and cross-tenant tests of the plans and the
  audit log.

Changed:

- `apps/api/src/common/auth/permissions.ts`: `plan.read`, `platform.plans.read`,
  `platform.plans.manage`, `audit.log.read`, and `platform.audit.log.read`.
- `apps/api/src/common/audit/audit-actions.ts`: the action `DEPOT_PLAN_CHANGED`.
- `apps/api/src/modules/auth/auth.service.ts`: a new depot gets the Free Trial plan.
- `apps/api/src/modules/users/users.service.ts`: the user limit now comes from the shared helper.
- `apps/api/src/modules/products/products.service.ts`: the product limit of the plan.
- `apps/api/src/app.module.ts`: the plans module and the audit log module.
- `apps/api/test/auth.service.spec.ts`: the mock of the registration transaction has the plan and the
  subscription.
- `scripts/seed/seed.ts`: the demo depots get a plan (the beer depot Pro, the energy depot and the rice
  depot Basic).
- `README.md`: the new endpoints, the plans, and the audit log.

## Tests run

- `pnpm format:check` — passed.
- `pnpm lint` — passed for API and web.
- `pnpm test` — passed: API 21 suites / 130 tests; web 30 suites / 162 tests.
- `pnpm --filter api test:tenant` — passed: 10 suites / 137 tests (the new plan and audit log suite is
  one of them). The tenant tests reset `smartdepo_test`; the development database was not reset.
- `pnpm build` — passed for NestJS and Next.js.

### Live check against the running backend

Yes. The API ran on `http://localhost:3001` with the development database and the three demo depots of
report 022:

- The owner of the demo beer depot read `GET /api/v1/depot/plan`: the plan Pro with the limits 50
  users and 1000 products, and the usage of 3 users and 4 products.
- The sales staff got a 403 on the same endpoint.
- The Platform Admin listed `GET /api/v1/platform/plans`: Free Trial (0.00, 5 users, 10 products),
  Basic (19.00, 15 users, 100 products), and Pro (49.00, 50 users, 1000 products). A depot owner got a
  403.
- The owner read `GET /api/v1/audit-log`: 1181 entries of the demo depot with the actor, the action,
  and the details of every change. The sales staff got a 403.
- The Platform Admin read `GET /api/v1/platform/audit-log` with the entries of the platform only (the
  logins of the Platform Admin, for example).
- The plan change answered 404 for an unknown depot and 400 for a plan code that does not exist.
- The generator was run again: the three demo depots have their plan (Pro, Basic, Basic) and the old
  Free Trial subscription is closed.

## Security check

- The plan of the depot and the audit log of the depot are read through the tenant transaction of the
  caller, so the depot comes from the access token and never from the request. The cross-tenant test
  proves that the owner of depot B sees no entry of depot A, and that the plan change of depot A is
  invisible in the log of depot B.
- The audit log is append-only in the database: the restrictive policies of the migration refuse an
  update and a delete for every role, including the Platform Admin. There is no update and no delete
  endpoint, and the tests check that the routes do not exist.
- The permissions are default-deny: the log of the depot needs `audit.log.read` (owner only), the log
  of the platform needs `platform.audit.log.read` (Platform Admin only), and the tests show that the
  sales staff, the stock keeper, and the delivery staff get a 403.
- The details of an entry are cleaned before they are shown: every key that looks like a password, a
  token, a key, or a secret is removed, also in the nested values. The tests insert an entry with a
  password hash and a refresh token and check that neither reaches the answer.
- The plan change is a cross-depot write, so it runs in the platform transaction of the Platform Admin
  and writes an audit entry with the plan before and after.
- The limits are enforced inside the transaction of the creation, so two parallel requests cannot
  both pass the check.
- No secret was added. The generator still reads the demo passwords from the environment and never
  prints them.

## Open issues / risks

- The limits of the plans are a decision of the team, not of the PRD: Free Trial 5 users and 10
  products, Basic 15 users and 100 products, Pro 50 users and 1000 products. The Free Trial had to
  be big enough for the scenarios of the existing tests, which create up to four staff accounts and
  four products in one depot.
- The plans of the demo depots are set by the generator. A depot that is created through the
  registration always starts with the Free Trial.
- The price of a plan is a number for display only. Nothing is charged and there is no payment
  provider, so the price is not connected to anything.
- The audit log grows without a limit. A depot with many entries needs an archive job or a
  retention rule later; the list is paged, so only the visible page is loaded.
- The filters of the audit log are exact matches for the action and the type of record. There is no
  free text search over the details of an entry.
- The list of the platform shows the entries without a depot only. A Platform Admin that wants the
  log of one depot has to ask the owner of that depot; a cross-depot log view would need a separate
  permission and a careful review.
- The frontend of the plans and the audit log is not part of this task. The endpoints are in the
  Swagger document, so the screens can be built on them.
- The `plans` table was empty before this task, so the platform dashboard counted the depots under
  "No plan". The depots now have a plan, and the card shows the real number.

## Decisions needed from the human

- Confirm the limits of the three plans (5 / 15 / 50 users and 10 / 100 / 1000 products) and the
  prices that are only shown (0.00, 19.00, and 49.00).
- Confirm that a new depot starts with the Free Trial and stays there until the Platform Admin moves
  it to another plan.
- Confirm that the Platform Admin sees only the entries of the platform and not the log of a depot.
- Confirm whether the audit log needs a retention rule or an archive job later.

## Status

ready for review

## Human review (filled in by the human only)
Decision: approved
Notes:
