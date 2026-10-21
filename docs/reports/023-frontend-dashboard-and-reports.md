# Task: Frontend for the dashboard and the reports

## FR IDs

- FR-5: the dashboard of the platform for the Platform Admin.
- FR-42: the sales report by day, week, month, and a custom period.
- FR-43: the sales report by product, category, customer, and staff member.
- FR-44: the inventory report (stock, low stock, near expiry, stock value).
- FR-45: the credit report (outstanding balances and ageing by customer).
- FR-46: the profit report (revenue, cost of goods sold, gross margin).
- FR-47: the purchase report by supplier and period.
- FR-48: the CSV export of every report.
- FR-49: the dashboard of the depot with the KPI cards and the charts.
- FR-3: the navigation and the route guards of the new screens.

## Summary

Added the business intelligence part of the frontend on top of the API of report 022. The dashboard of
the depot shows the nine cards and the ten charts of the depot, and every card and every chart
links to the report with the same numbers. The charts use Recharts; the amounts stay decimal
strings in the data of the API, the chart only uses a number for the geometry, and the label and the
tooltip show the exact amount of the API.

The reports have their own pages under `/reports` with a period picker (today, the last seven days,
this month, or a custom period with the days of the depot), a summary, a table that sorts in the
browser, and a button that downloads the report as a CSV file with the `format=csv` option of the
API. The sales report has the tabs "by period", "by product", "by category", "by customer", and "by
staff". Because the reports of the API have no pages, a report with more than 200 rows shows a
warning.

The roles follow the permission map of the API: the sales staff see the sales report and the sales
part of the dashboard, the stock keeper the inventory and the purchase reports, and the owner every
report. The Platform Admin gets the dashboard of the platform with the depots over time, the active
depots, the depots per plan, and the approvals that wait.

## Files changed

New:

- `apps/web/src/lib/permissions.ts`: the frontend mirror of the permission map of the API
  (`reports.sales`, `reports.full`, `reports.inventory`, `reports.purchases`, `dashboard.view`,
  `platform.dashboard.view`).
- `apps/web/src/lib/depot-dates.ts`: the days of the depot (Asia/Phnom_Penh), the presets, and the
  checks of a period.
- `apps/web/src/features/dashboard/dashboard-manager.tsx`: the dashboard of the depot with the cards,
  the charts, the grouping switch of the trend, and the parts that the role may see.
- `apps/web/src/features/dashboard/dashboard-charts.tsx`: the chart panels and the charts (the
  trend, the horizontal bars, the ageing, the days of the week, and the purchases against the
  sales) with the tooltip that shows the exact amount of the API.
- `apps/web/src/features/dashboard/chart-data.ts`: the pure mapping of the data of the API to the
  data of the charts.
- `apps/web/src/features/reports/reports-manager.tsx`: the pages of the reports with the summary, the
  table, and the CSV download.
- `apps/web/src/features/reports/report-table.tsx`: the table that sorts in the browser.
- `apps/web/src/features/reports/date-range-picker.tsx`: the picker of the period.
- `apps/web/src/features/reports/report-parts.tsx`: the loading skeleton, the error, the warning for
  a large report, and the CSV button.
- `apps/web/src/features/reports/report-registry.ts`: the reports with their permission, their
  address, and the name of their CSV file.
- `apps/web/src/features/reports/report-index.tsx`: the index of the reports of the role.
- `apps/web/src/features/platform-dashboard/platform-dashboard-manager.tsx`: the dashboard of the
  platform.
- `apps/web/src/app/(app)/reports/page.tsx` and the pages of `sales`, `inventory`, `credit`,
  `profit`, and `purchases`.
- `apps/web/src/app/(app)/platform/dashboard/page.tsx`.
- Tests: `apps/web/src/lib/depot-dates.spec.ts`, `apps/web/src/features/dashboard/chart-data.spec.ts`,
  `apps/web/src/features/dashboard/dashboard-manager.spec.tsx`,
  `apps/web/src/features/reports/report-registry.spec.ts`, and
  `apps/web/src/features/reports/reports-manager.spec.tsx`.

Changed:

- `apps/web/src/lib/types.ts`: the types of the reports, the dashboard, and the platform dashboard.
- `apps/web/src/lib/api-client.ts`: the clients of the reports, the dashboard, and the platform
  dashboard, and `downloadReportCsv`.
- `apps/web/src/lib/navigation.ts`: the entry of the reports (owner, sales, and stock keeper), the
  entry of the platform dashboard, the route guard of `/reports`, and the home page of the Platform
  Admin.
- `apps/web/src/lib/navigation.spec.ts`: the new expectations of the navigation and the tests of the
  reports per role.
- `apps/web/src/components/app-shell.tsx`: the icon of the reports.
- `apps/web/src/app/(app)/dashboard/page.tsx`: the placeholder is now the real dashboard.
- `apps/web/src/app/globals.css`: the cards, the chart panels, the report index, the period picker,
  and the report tables.
- `apps/web/src/i18n/en.json` and `apps/web/src/i18n/km.json`: every new label in both languages.
- `apps/web/package.json` and `pnpm-lock.yaml`: Recharts.

## Tests run

- `pnpm format:check` — passed.
- `pnpm lint` — passed for API and web.
- `pnpm test` — passed: API 20 suites / 124 tests; web 30 suites / 162 tests (the web had 25 suites
  and 128 tests before this task).
- `pnpm --filter api test:tenant` — passed: 9 suites / 123 tests.
- `pnpm build` — passed for NestJS and Next.js; the build lists `/dashboard`, `/reports`,
  `/reports/sales`, `/reports/inventory`, `/reports/credit`, `/reports/profit`,
  `/reports/purchases`, and `/platform/dashboard`.
- `pnpm --filter web exec tsc --noEmit -p tsconfig.json` — passed.

### Live check against the running backend

Yes. The API ran on `http://localhost:3001` with the development database and the Next.js app on
`http://localhost:3000`, with the three demo depots of report 022. A temporary Playwright script
(deleted afterwards) drove the screens with the owner of the demo beer depot, the demo sales staff,
the demo stock keeper, and the Platform Admin:

- The owner of the demo beer depot saw the nine cards (0 KHR sales today, 548.30 KHR sales of the
  month, 28 invoices, 829.89 KHR outstanding credit, 663.49 KHR overdue, 128.70 KHR gross profit at
  23.47 %, 0 products with low stock, 1 batch that expires soon) and every chart: the sales of the
  last 14 days, the top ten products by revenue and by quantity, the sales by category, the top
  customers by sales and by balance, the credit ageing with the three buckets, the sales by day of
  the week, the purchases against the sales, and the slow-moving stock.
- The report pages loaded their data: the sales report of the month showed 20 rows and the summary
  of the API, the credit report showed the balance of every customer with the ageing buckets, and
  the inventory report showed the readable units of the stock.
- The CSV button downloaded `sales.csv` with the header row of the API
  (`Period,Invoices,Subtotal,Discount,Total,Paid,Outstanding`) and the rows of the period.
- The sales staff saw only the three sales cards, only the trend, and only the "Sales over time"
  report; the stock keeper saw the two inventory cards, the slow-moving stock, and the inventory and
  purchases reports. The navigation followed the same roles.
- The Platform Admin landed on `/platform/dashboard` with 17 registered depots, 12 active depots, 0
  pending approvals, the charts, and the link to the depot review.
- The Khmer view renders with Noto Sans Khmer in the navigation, the cards, the tabs, the period
  picker, the summary, and the tables. The phone layout (iPhone 13) stacks the cards in two
  columns, keeps the charts at a fixed height, and the tables stay readable.

## Security check

- The frontend never decides what is allowed: the screens only call the endpoints of report 022, and
  the API stays the real guard. The permission map of `apps/web/src/lib/permissions.ts` mirrors the
  map of the API and only decides what the navigation shows and which report tabs are rendered.
  A report that the role may not read shows the forbidden screen instead of the data.
- The depot id never comes from the browser: every request goes through the existing API client,
  which sends the access token, and the API takes the depot from the token.
- The CSV download uses the same token as the JSON answers: the file is fetched with the access
  token and handed to the browser as a download, so no token ends up in a URL or in a file name.
- The money is never calculated in the browser: the amounts come from the API as decimal strings
  and are only formatted. The sorting of the tables compares the decimal strings with the
  `compareDecimal` helper of the library, so the order never depends on a floating point number.
  The chart geometry uses a number, but the tooltip and the table show the exact string.
- The days are the days of the depot (UTC+7, the same as the API), so the period of a report and
  the label of a row always agree.
- No token, secret, or real personal data was added. The live check used the demo depots and the
  local Platform Admin of the development environment.

## Open issues / risks

- Recharts was added as a dependency. It is the chart library of the technology stack of
  `AGENTS.md`, and it was the only way to draw the charts of FR-49.
- The app has no dark mode: the stylesheet sets `color-scheme: light` and has no
  `prefers-color-scheme` block, so the new colours are chosen for the light surface. They are dark
  enough for the contrast of a graphic, and the series colours are also readable on a dark surface,
  but the panels themselves would need a dark theme.
- The reports of the API have no pages, so a report with many rows is sent and sorted in the
  browser. The warning appears above 200 rows; a depot with more rows than that should get a paged
  report from the API.
- The grouping switch of the sales trend on the dashboard reads the sales report of the API with
  the period of the grouping (14 days, 12 weeks, or 6 months) instead of the trend of the dashboard
  endpoint, so the days and the weeks of the trend are the days and the weeks of the API.
- The dashboard of the platform counts the depots under "No plan", because the `plans` table of the
  development database is empty (no migration fills it). The chart shows the real number once the
  plans exist.
- The card of "Sales today" is 0 for a depot without sales today; the demo data ends on the day
  before the demo run.
- The ageing buckets of the credit screen were flat i18n keys (`credit.bucket.0-30`), and the
  lookup of a key splits on the dot, so the labels never resolved and the raw key was shown. The
  buckets are nested objects now, and the credit screen shows the labels. The new keys of this task
  are nested objects as well.
- The report pages are one page per report, so a depot with a very long sales period gets a long
  table. The table header sorts the rows, but there is no paging and no search.
- The frontend for the reports and the dashboard has no Playwright test yet; the live check of this
  task was a temporary script. The unit and component tests cover the formatting, the chart data,
  the dashboard, and the roles.

## Decisions needed from the human

- Confirm that the sales staff may keep seeing the three sales cards and the trend of the
  dashboard, and that the stock keeper keeps only the inventory cards and the slow-moving stock.
- Confirm that a report with more than 200 rows shows the warning instead of being paged, or that
  the API should get a limit and a page parameter.
- Confirm that the period of the trend of the dashboard follows the grouping (14 days, 12 weeks, 6
  months).
- Confirm that the platform dashboard counts the depots without a plan under "No plan" until the
  `plans` table is filled.
- Confirm that the demo depots of report 022 keep their data in the development database for the
  demo and the tests of the BI screens.

## Status

ready for review

## Human review (filled in by the human only)
Decision: approved
Notes:
