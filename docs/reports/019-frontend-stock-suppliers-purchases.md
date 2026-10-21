# Task: Frontend for stock, suppliers, and purchases

## FR IDs

- FR-15: batch number and expiry date for batch-tracked products (P1), shown per batch in the stock
  list and required on purchase lines.
- FR-17: stock movements, read as the append-only movement history with who and why.
- FR-18: current stock derived from movements, shown in readable units and in base units.
- FR-19: manual stock adjustment with a required reason.
- FR-20: low-stock alert at or below the reorder level, with a low-stock filter and marker.
- FR-21: near-expiry and expired stock alerts with a day threshold (P1).
- FR-36: supplier management (name, contact, phone, email, address, notes).
- FR-37: record a purchase with lines, units, quantities, and unit cost.
- FR-38: receiving a purchase, batch and expiry, and the cost price shown on the product screen.
- FR-16 / FR-50 groundwork (extras requested): the read-only price history table with who, when, and
  the old and new amount.
- FR-3: role-aware navigation and client route guards for the new screens.

## Summary

Added the depot frontend for stock, suppliers, and purchases on top of the API from report 018. The
stock screen shows current stock per product in readable units and base units with a low-stock marker,
a search box, an "All stock / Low stock" filter, and one row per batch for batch-tracked products. The
same screen holds the adjustment and damage form, the expiry alerts with a day threshold, and the
movement history with product, type, and date-range filters, pagination, and the user and reason of
every movement. New supplier and purchase screens cover create, edit, archive, draft editing, and
receive or cancel with confirmations. The products screen now shows the current stock, the last cost
per base unit, and the real price history table. All money and quantity maths in the browser uses
scaled `BigInt` helpers, so the client never does floating-point arithmetic.

## Files changed

New pages:

- `apps/web/src/app/(app)/stock/page.tsx`
- `apps/web/src/app/(app)/suppliers/page.tsx`
- `apps/web/src/app/(app)/purchases/page.tsx`

Stock feature:

- `apps/web/src/features/stock/stock-manager.tsx`: page composition, product and stock loading, role
  handling, and the read-only notice for roles that cannot manage stock.
- `apps/web/src/features/stock/stock-table.tsx`: current-stock table with search, the all/low filter,
  base units, the low-stock marker, and per-batch rows.
- `apps/web/src/features/stock/movement-history.tsx`: product, type, and date-range filters with
  pagination, showing the user and the reason.
- `apps/web/src/features/stock/stock-movement-form.tsx`: adjustment and damage form with product, unit,
  signed quantity, required reason, and batch selection for batch-tracked products.
- `apps/web/src/features/stock/batch-alerts.tsx`: near-expiry and expired batches with a day threshold.
- `apps/web/src/features/stock/stock-errors.ts`: recognises the API "Insufficient stock" answer.

Suppliers feature:

- `apps/web/src/features/suppliers/suppliers-manager.tsx`: list, search, status filter, pagination,
  and the archive confirmation.
- `apps/web/src/features/suppliers/supplier-form.tsx`: create and edit form with validation.

Purchases feature:

- `apps/web/src/features/purchases/purchases-manager.tsx`: list with status filter, draft actions,
  receive and cancel confirmations, and the read-only detail view.
- `apps/web/src/features/purchases/purchase-form.tsx`: draft form with supplier, notes, and lines
  (product, unit, quantity, unit cost, batch number, expiry date) with line and total amounts.
- `apps/web/src/features/purchases/purchase-drafts.ts`: pure draft helpers for line totals, purchase
  totals, and per-line validation.

Products feature:

- `apps/web/src/features/products/price-history-table.tsx`: read-only price history with unit, price
  type, old amount, new amount, the user who changed it, and the date.
- `apps/web/src/features/products/price-editor.tsx`: the placeholder note is replaced by the real
  history table.
- `apps/web/src/features/products/products-manager.tsx`: current stock and cost price columns, and the
  low-stock marker now uses the API flag.

Shared code:

- `apps/web/src/lib/api-client.ts`: typed clients for stock, movements, batch alerts, adjustments,
  damage, suppliers, purchases, and price history.
- `apps/web/src/lib/types.ts`: product stock and cost fields plus the new stock, supplier, purchase,
  and price-history types.
- `apps/web/src/lib/decimal.ts`: scaled `BigInt` helpers for multiplication, division, summation,
  rounding to the money and quantity scales, base-unit conversion, base-unit cost, and line totals.
- `apps/web/src/lib/navigation.ts`: Stock, Purchases, and Suppliers entries with their roles, plus
  the client route guards.
- `apps/web/src/components/app-shell.tsx`: icons for the new navigation entries.
- `apps/web/src/app/globals.css`: styles for the batch rows, purchase lines, wide fields, and the
  stacked expiry-alert tables.
- `apps/web/src/i18n/en.json` and `apps/web/src/i18n/km.json`: all new text in English and Khmer.

Tests:

- `apps/web/src/features/purchases/purchase-drafts.spec.ts`: line totals, purchase totals, and the
  per-line validation rules.
- `apps/web/src/features/purchases/purchase-form.spec.tsx`: the purchase form computes totals, sends
  the right payload, and asks for a batch and expiry on tracked products.
- `apps/web/src/features/purchases/purchases-manager.spec.tsx`: draft actions, the receive and cancel
  confirmations, and the status filter.
- `apps/web/src/features/stock/stock-manager.spec.tsx`: role-based screens, the movement history, the
  low-stock filter, and the negative-stock error message.
- `apps/web/src/features/suppliers/suppliers-manager.spec.tsx`: create, edit, archive confirmation,
  and email validation.
- `apps/web/src/lib/decimal.spec.ts`: the new money and quantity helpers.
- `apps/web/src/lib/navigation.spec.ts`: the new navigation entries and route guards.
- `apps/web/src/features/products/price-editor.spec.tsx`: the price history table.

Documentation:

- `README.md`: the new frontend screens, permissions, and the decimal rules.
- `docs/reports/019-frontend-stock-suppliers-purchases.md`: this report.

## Tests run

- `pnpm format:check` — passed.
- `pnpm lint` — passed for API and web.
- `pnpm test` — passed: API 16 suites / 98 tests; web 21 suites / 102 tests.
- `pnpm build` — passed for NestJS and Next.js; the build lists the new routes `/stock`,
  `/suppliers`, and `/purchases`.
- `pnpm --filter web exec tsc --noEmit -p tsconfig.json` — passed.

### Live check against the running local backend

This task was tested against the live local stack: the API on `http://localhost:3001` and the Next.js
app on `http://localhost:3000`, both already running for the previous task. A throwaway depot
("UI Check Depot") was registered through the API, approved with the seeded Platform Admin, and filled
with a category, two products (one batch-tracked), one supplier, three received purchases, one draft
purchase, and two price changes. The screens were driven with a temporary Playwright script (deleted
afterwards) and checked in English and Khmer at desktop width (1280 px) and phone width (iPhone 13):

- Stock: the table shows `14 cartons` with `336 bottle` in the base-unit column, one row per batch
  with the formatted expiry date, the low-stock marker on the product below its reorder level, the
  adjustment form, the near-expiry and expired tables, and the movement history with the user and the
  reason.
- Purchases: the draft row shows View, Edit, Receive, and Cancel; received rows show only View. The
  draft form shows the line total `240.00` and the total amount `240.00`, and the base-unit cost hint.
- Suppliers: the list, the create and edit form, and the archive confirmation dialog.
- Products: the current stock, the cost price, and the price history table with the old and new amount.
- Khmer: all new screens render with Noto Sans Khmer, including the purchase form and the stock
  tables.
- Phone: the forms collapse to one column, the tables scroll horizontally, and the sidebar collapses
  into the menu button.
- Roles: a SALES account sees only Dashboard, Products, Stock, Settings, and Change password; opening
  `/suppliers` redirects to `/forbidden`, and the stock screen shows the read-only notice without the
  adjustment form.

The sample depot and its data are still in the development database and can be deleted whenever the
human wants.

Running `pnpm build` while the API dev server was running stopped the watch-mode API with
`Cannot find module '.../apps/api/dist/main'`, so the Next.js proxy answered 502 and the login screen
showed "The server had a problem." The API dev server was restarted, the login through the proxy
returned 200 again, and the stock page loaded with no error banner. The pitfall and the fix are now
documented in `README.md`.

## Security check

- The new screens call only the endpoints from report 018; no client-side check replaces a server
  permission. SALES can only read stock because the API allows `STOCK_READ` for that role.
- Route guards and navigation entries follow the same roles as the API permissions, and the read-only
  notice explains the limit to the user instead of hiding controls silently.
- The access token stays in the in-memory session store; the new screens use the existing API client,
  so the refresh cookie and the 401 retry behave exactly as before.
- No secrets, tokens, or real personal data were added. The live check used fake sample data
  (`ui-check-owner@example.com` and similar) on the local development database.
- Money and quantities are handled as decimal strings and scaled `BigInt` values in the browser; no
  `Number` conversion is used for amounts or quantities.

## Open issues / risks

- The dev database now contains the "UI Check Depot" sample depot, its staff, products, supplier, and
  purchases. It is fake data, but it should be deleted before the demo seed runs.
- The API reason text of a movement (for example "Purchase received") is stored in English by the
  server and is shown as it is; only the interface labels are translated.
- The shared `formatDate` helper renders Khmer dates with the browser's `km-KH` pattern, which fell
  back to "Oct 21, 2026" in the headless browser used for the check. This is pre-existing behaviour
  from the earlier tasks, not introduced here, but the Khmer dates should be reviewed before the demo.
- The purchase form lists every product and supplier of the depot in a select box. A depot with a very
  large catalog will need a searchable picker.
- The stock screen loads the products and the stock page separately for the form and the history
  filter, so a very large depot makes four requests per page load.
- The SALES role can read categories in the API since report 018, but the frontend still hides the
  Categories navigation entry and the category filter from SALES. That was left as it is to keep this
  task to stock, suppliers, and purchases.
- The client shows the "Insufficient stock" message from the API in English next to the translated
  headline. A structured error code from the API would let the UI translate the whole message.
- No frontend work was done for supplier payables, delivery, or the first-expiry-first-out suggestion
  (FR-22), which stay out of scope.

## Decisions needed from the human

- Confirm that the stock screen should keep the "All stock / Low stock" tabs instead of a separate
  low-stock page.
- Confirm that the purchase form should use a plain select box for products and suppliers before the
  catalog grows.
- Confirm whether the Categories screen should be opened to SALES now that the API allows
  `CATEGORIES_READ`.
- Confirm whether the "UI Check Depot" sample data should be deleted from the development database.

## Status

ready for review

## Human review (filled in by the human only)
Decision: approved
Notes:
