# Task: Reports, dashboard data, and the sample data generator

## FR IDs

- FR-5: platform admin dashboard data (depots over time, active depots, depots per plan, pending
  approvals).
- FR-42: sales report by day, week, month, and a custom range.
- FR-43: sales report by product, category, customer, and staff member.
- FR-44: inventory report (current stock, low stock, near expiry, stock value).
- FR-45: credit report (outstanding balances and ageing by customer).
- FR-46: profit report (revenue, cost of goods sold, gross margin, by product and overall).
- FR-47: purchase report by supplier and period.
- FR-48: CSV export for every report.
- FR-49: depot dashboard with KPI cards and chart data.
- FR-1 (partial): a depot that is approved gets its default walk-in customer.

## Summary

Added the business intelligence layer of the API. Every report is scoped by the depot of the access
token: the queries live in `apps/api/src/prisma/report-queries.ts`, they are parameterized, and each
one filters on the depot id; the tenant session and the row-level security policies are the second
layer. The days are grouped in the time of Phnom Penh (UTC+7) and voided invoices are never
counted. The reports are sales by period, sales by product, category, customer, and staff member,
inventory with the value of the stock, credit with the ageing buckets, profit with the cost of the
sold lines, and purchases per supplier and month. Every report can be downloaded as CSV with
`format=csv`. The dashboard endpoint returns the KPI cards and the chart data of the depot, and the
platform dashboard returns the data of the platform for the Platform Admin only.

The permission map was extended: the owner sees every report, the sales staff only the totals and
the trend of the sales report, the stock keeper the inventory and the purchase reports, and the
platform admin only the platform data.

`scripts/seed/seed.ts` replaces the placeholder. It creates three demo depots (beer, energy
drinks, and rice) with owners, staff, categories, products with units and prices, suppliers,
customers, and about three months of purchases, invoices (paid, partly paid, and on credit),
payments, stock adjustments, and near-expiry batches. The business data is written through the real
services of the API, so the invoice numbers, the stock ledger signs, the batch allocation, and the
payment allocations follow the same rules as a live depot; only the dates of the invoices, the
purchases, and their movements are moved to the day they belong to, because the services always use
the current time. The random seed is fixed, the generator refuses to run without `--demo`, only ever
touches depots whose name starts with `Demo `, reads the login passwords from the environment, and
never prints them.

## Files changed

New:

- `apps/api/src/prisma/report-queries.ts`: the parameterized report SQL. Every statement filters on
  the depot id and groups the days in `Asia/Phnom_Penh`.
- `apps/api/src/modules/reports/reports.module.ts`: the module of the reports and the dashboard.
- `apps/api/src/modules/reports/reports.controller.ts`: the report routes, the CSV answer, and the
  permission of every route.
- `apps/api/src/modules/reports/reports.service.ts`: the queries, the formatting, and the CSV files.
- `apps/api/src/modules/reports/dashboard.service.ts`: the KPI cards and the chart data of the depot.
- `apps/api/src/modules/reports/dashboard.controller.ts`: `GET /api/v1/dashboard`.
- `apps/api/src/modules/reports/report-calculations.ts`: the pure helpers (ageing buckets, margin,
  the local day range of the depot, the CSV escaping).
- `apps/api/src/modules/reports/dto/report.dto.ts` and `dto/report-query.dto.ts`: the Swagger
  classes and the query DTOs.
- `apps/api/src/modules/platform-admin/platform-dashboard.controller.ts` and
  `dto/platform-dashboard.dto.ts`: `GET /api/v1/platform/dashboard`.
- `apps/api/src/bootstrap/seed-context.ts`: the Nest application context for the generator.
- `apps/api/src/prisma/migrations/20261022140000_reports_and_walk_in/migration.sql`: the walk-in
  customer for the depots that were approved before this task, and the two new indexes.
- `apps/api/test/report-calculations.spec.ts`: the unit tests of the calculations.
- `apps/api/test/reports.db.tenant-spec.ts`: the API and cross-tenant tests with known totals.
- `scripts/seed/package.json`: the folder runs as an ES module.

Changed:

- `apps/api/src/prisma/schema.prisma`: the indexes `sales_orders(depot_id, status, order_date)` and
  `sales_orders(depot_id, created_by_id)`.
- `apps/api/src/common/auth/permissions.ts`: `REPORTS_SALES`, `REPORTS_FULL`, `REPORTS_INVENTORY`,
  `REPORTS_PURCHASES`, `DASHBOARD_VIEW`, and `PLATFORM_DASHBOARD_VIEW`.
- `apps/api/src/common/money/money.ts`: `sumMoney` and `compareMoney` for the report sums.
- `apps/api/src/modules/platform-admin/platform-admin.service.ts`: the walk-in customer when a depot
  is approved, and the data of the platform dashboard.
- `apps/api/src/modules/platform-admin/platform-admin.module.ts`: the new controller.
- `apps/api/src/app.module.ts`: the reports module.
- `package.json`: `pnpm seed` builds the API and runs the generator.
- `.env.example`: `DEMO_OWNER_PASSWORD` and `DEMO_STAFF_PASSWORD`.
- `README.md`: the new endpoints, the report section, and the sample data generator section.

## Tests run

- `pnpm format:check` — passed.
- `pnpm lint` — passed for API and web.
- `pnpm test` — passed: API 20 suites / 124 tests; web 25 suites / 128 tests.
- `pnpm --filter api test:tenant` — passed: 9 suites / 123 tests (the new report suite is one of
  them). The tenant tests reset `smartdepo_test`; the development database was not reset.
- `pnpm build` — passed for NestJS and Next.js.

### Live check against the running backend

Yes. The API ran on `http://localhost:3001` with the development database, and every report and the
dashboard were called with the owner of a demo depot. The answers hold the expected numbers, for
example for the beer depot: sales of 2,589.60 over the period with 829.89 still open, a profit of
630.15 at a margin of 24.33 %, a stock value of 18,136.85, and the ageing split over the three
buckets. The CSV answer comes back with `text/csv` and the header row of the report.

The generator was run against the development database and produced three demo depots with about 130
invoices each (paid, partly paid, and on credit), 30 purchases each, 60 batches each for the two
depots with batches, and near-expiry batches that the inventory report lists.

### Speed with about 50,000 invoice lines

The test database was loaded with 10,000 invoices and 50,000 invoice lines for one depot, and the
API was started against `smartdepo_test` to time the real endpoints:

| Endpoint                      | Time  |
| ----------------------------- | ----- |
| `/reports/sales?unit=day`     | 32 ms |
| `/reports/sales?unit=month`   | 19 ms |
| `/reports/sales/by-product`   | 86 ms |
| `/reports/sales/by-category`  | 96 ms |
| `/reports/sales/by-customer`  | 10 ms |
| `/reports/sales/by-staff`     | 8 ms  |
| `/reports/inventory`           | 22 ms |
| `/reports/credit`              | 46 ms |
| `/reports/profit`              | 101 ms |
| `/reports/purchases`           | 3 ms  |
| `/dashboard`                   | 260 ms |

The target of three seconds is met with a wide margin. The test database was reset by the tenant
tests afterwards.

## Security check

- Every report query filters on the depot id that comes from the access token, and runs inside the
  tenant transaction of the caller, so the row-level security policies apply on top of it. The
  cross-tenant test proves that the owner of depot B sees no invoice, no product, and no customer of
  depot A in any report.
- Every new route has an explicit permission, and the guard denies a route without one. The tests
  prove that a request without a token is answered with 401, that the sales staff get 403 on the
  profit and the credit report, and that the stock keeper gets 403 on those and 200 on the
  inventory and the purchase report. The platform dashboard needs the Platform Admin role, and the
  depot owner gets 403.
- The raw SQL is only allowed in `apps/api/src/prisma`, and every value is a bound parameter; the
  only literal that comes from the request is the grouping unit, and it is checked against a fixed
  list by the DTO.
- Money and quantities stay decimal strings; the sums use `Prisma.Decimal` and the report rows are
  formatted with `toMoney`. No amount is a floating point number.
- The walk-in customer is created inside the approval transaction of the Platform Admin, and the
  migration uses a unique partial index, so it can never be created twice.
- The generator reads the passwords from the environment, never hard-codes them, and never prints
  them. It refuses to run without `--demo`, only deletes data of depots whose name starts with
  `Demo `, and refuses to run against `smartdepo_test` unless `--allow-test-database` is given.
- No secrets, tokens, or real personal data were added. The demo data is fake.

## Open issues / risks

- The reports have no pagination: a depot with 50,000 invoice lines gets every row of the sales by
  product report in one answer. The CSV export of such a report is also large. The reports were
  measured with 50,000 lines and stay fast, but a very large depot may need a limit and a page
  parameter.
- The generator runs against the compiled API in `apps/api/dist`, because the dependency injection
  of Nest needs the decorator metadata that only the TypeScript compiler writes. `pnpm seed` builds
  the API first. A seed that runs from the TypeScript sources would need another build step.
- The generator cannot delete a demo depot: the audit log is append-only and the depot row points at
  it. The generator therefore reuses the depot and clears its data. The audit entries of the earlier
  runs stay in the audit log of the depot.
- The services always use the current time, so the generator moves the invoice, the purchase, and
  their movements to the day of the demo period with one update after the service call. The invoice
  numbers, the totals, the allocations, and the ledger stay exactly as the services wrote them.
- The profit report uses the cost per base unit that was stored on the sale line. A product without
  a cost shows a margin of 100 %, and the depot owner should keep the purchase costs up to date.
- The dashboard makes about thirteen queries. It answered in 260 ms with 50,000 invoice lines, but a
  depot with a much larger history may want the cards and the charts split over two endpoints.
- The platform dashboard counts the depots that registered per month, the approved depots, the
  depots per plan, and the pending approvals. The `plans` table is empty in the development
  database (no migration fills it), so the depots are counted under "No plan" until the plans exist.
- The PDF export of the reports is not part of this task; only the CSV export is.
- The frontend for the reports and the dashboard is not part of this task; the API and the Swagger
  document are ready for it.

## Decisions needed from the human

- Confirm that the sales report of the sales staff may show the totals and the trend of the period
  (the detailed breakdowns stay with the owner).
- Confirm the ageing buckets: 0-30, 31-60, and over 60 days past the due date.
- Confirm that the demo depots keep the name prefix `Demo ` and that the generator reuses them
  instead of deleting them.
- Confirm that the demo login accounts are `demo-beer-owner@example.com`,
  `demo-energy-owner@example.com`, and `demo-rice-owner@example.com` with the passwords from
  `DEMO_OWNER_PASSWORD`, and `sales@` / `keeper@` with the same domain for the staff.
- Confirm whether the `plans` table should be filled by a migration, because the user limit of the
  plan and the "depots per plan" card of the platform dashboard depend on it.

## Status

ready for review

## Human review (filled in by the human only)
Decision: approved
Notes:
