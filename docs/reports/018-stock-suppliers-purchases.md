# Task: Stock, suppliers, and purchases

## FR IDs

- FR-15: batch number and expiry date for batch-tracked products (P1).
- FR-17: every stock change is a stock movement with date, user, and quantity.
- FR-18: current stock is derived from movements and shown in readable units.
- FR-19: manual stock adjustment with a required reason.
- FR-20: low-stock alert at or below the reorder level.
- FR-21: near-expiry and expired stock alerts (P1).
- FR-36: manage suppliers (name, contact, notes).
- FR-37: record a purchase with items, units, quantities, and unit cost.
- FR-38: receiving a purchase increases stock, saves batch and expiry, and updates the cost price.
- FR-16 / FR-11 (extra requested): read-only price-history endpoint, and read-only category access for SALES.
- FR-50 groundwork: audit entries for adjustments, damage, suppliers, and purchases. The audit viewer is still later work.
- FR-22 (P2) is **not** implemented: first-expiry-first-out suggestion is out of scope for this task.

## Summary

Added the depot backend for stock, suppliers, and purchases. Stock is never stored as a number: it is
the sum of the `stock_movements` ledger in the base unit, and every change (purchase, sale, adjustment,
return, damage) is a signed row with depot, product, optional batch, reason, user, and timestamp.
The stock ledger service locks the product row inside the caller's transaction before reading the
current stock, so concurrent requests cannot both pass the negative-stock check. The module also adds
current-stock, low-stock, batch-stock, movement-history, and near-expiry/expired queries, manual
adjustments and damage entries with a required reason, depot suppliers, and the purchase lifecycle
(`DRAFT` -> `RECEIVED` or `CANCELLED`) where receiving creates the purchase movements, saves batches,
and updates the last cost per base unit in one transaction.

## Files changed

Schema and migrations:

- `apps/api/src/prisma/schema.prisma`: `products.cost_price` (`NUMERIC(14,2)`), and the
  `stock_movements(depot_id, type, created_at)`, `suppliers(depot_id, is_active)`, and
  `purchase_orders(depot_id, status, created_at)` indexes.
- `apps/api/src/prisma/migrations/20261021160000_stock_suppliers_purchases/migration.sql`: new
  `cost_price` column, CHECK constraints for the ledger, money, batches, suppliers, purchases, and
  purchase lines, the new indexes, and idempotent row-level security guards for `stock_movements`,
  `batches`, `suppliers`, `purchase_orders`, and `purchase_items`.
- `apps/api/src/prisma/stock-locks.ts`: parameterized `SELECT ... FOR UPDATE` row lock on the product
  row inside the caller's transaction (raw SQL is only allowed under `apps/api/src/prisma`).

Common code:

- `apps/api/src/common/money/money.ts`: decimal money helpers (`toMoney`, `calculateLineTotal`,
  `toBaseUnitCost`) that never use floating point.
- `apps/api/src/common/units/quantity.ts`: `assertPositiveQuantity` and `assertNonZeroQuantity`.
- `apps/api/src/common/validation/decimal.ts`: signed decimal pattern for adjustments.
- `apps/api/src/common/audit/audit-actions.ts`: stock, supplier, and purchase audit actions.
- `apps/api/src/common/auth/permissions.ts`: `STOCK_READ`, `STOCK_MANAGE`, `SUPPLIERS_READ`,
  `SUPPLIERS_MANAGE`, `PURCHASES_READ`, `PURCHASES_MANAGE`; SALES gains `CATEGORIES_READ` and
  `STOCK_READ`; STOCK_KEEPER gains the stock, supplier, and purchase permissions.

Stock module:

- `apps/api/src/modules/stock/stock.module.ts`
- `apps/api/src/modules/stock/stock.controller.ts`
- `apps/api/src/modules/stock/stock.service.ts`
- `apps/api/src/modules/stock/stock-ledger.service.ts` (reusable movement recorder for sales later)
- `apps/api/src/modules/stock/stock-calculations.ts` (stock derivation, low-stock, damage helpers)
- `apps/api/src/modules/stock/dto/stock.dto.ts`
- `apps/api/src/modules/stock/dto/list-stock-query.dto.ts`
- `apps/api/src/modules/stock/dto/list-movements-query.dto.ts`
- `apps/api/src/modules/stock/dto/batch-alerts-query.dto.ts`
- `apps/api/src/modules/stock/dto/adjust-stock.dto.ts`
- `apps/api/src/modules/stock/dto/damage-stock.dto.ts`

Suppliers module:

- `apps/api/src/modules/suppliers/suppliers.module.ts`
- `apps/api/src/modules/suppliers/suppliers.controller.ts`
- `apps/api/src/modules/suppliers/suppliers.service.ts`
- `apps/api/src/modules/suppliers/dto/supplier.dto.ts`
- `apps/api/src/modules/suppliers/dto/create-supplier.dto.ts`
- `apps/api/src/modules/suppliers/dto/update-supplier.dto.ts`
- `apps/api/src/modules/suppliers/dto/list-suppliers-query.dto.ts`

Purchases module:

- `apps/api/src/modules/purchases/purchases.module.ts`
- `apps/api/src/modules/purchases/purchases.controller.ts`
- `apps/api/src/modules/purchases/purchases.service.ts`
- `apps/api/src/modules/purchases/dto/purchase.dto.ts`
- `apps/api/src/modules/purchases/dto/purchase-line.dto.ts`
- `apps/api/src/modules/purchases/dto/create-purchase.dto.ts`
- `apps/api/src/modules/purchases/dto/update-purchase.dto.ts`
- `apps/api/src/modules/purchases/dto/list-purchases-query.dto.ts`
- `apps/api/src/modules/purchases/dto/cancel-purchase.dto.ts`

Products module changes:

- `apps/api/src/modules/products/product-select.ts`: `costPrice`, `currentStock`,
  `currentStockReadable`, and `lowStock` on the product view.
- `apps/api/src/modules/products/products.service.ts`: product list, read, edit, and archive now return
  the derived current stock and the low-stock flag.
- `apps/api/src/modules/products/product-prices.service.ts` and
  `apps/api/src/modules/products/product-prices.controller.ts`: read-only price history
  (`GET /api/v1/products/:id/units/:unitId/prices`) with who, when, and old/new amount.
- `apps/api/src/modules/products/dto/price-history.dto.ts`: price-history query and response DTOs.
- `apps/api/src/modules/products/dto/product.dto.ts`: new product response fields.
- `apps/api/src/modules/products/products.module.ts`: imports `StockModule` for the ledger service.

Wiring and documentation:

- `apps/api/src/app.module.ts`: registers `StockModule`, `SuppliersModule`, and `PurchasesModule`.
- `README.md`: new endpoint table rows, the stock/supplier/purchase section, and the note that SALES
  can read categories and prices history.
- `docs/reports/018-stock-suppliers-purchases.md`: this report.

Tests:

- `apps/api/test/stock-calculations.spec.ts`: unit tests for stock derivation, low-stock comparison,
  damage sign, money rounding, line totals, and per-base-unit cost conversion.
- `apps/api/test/stock.db.tenant-spec.ts`: database-backed API and cross-tenant tests, including the
  concurrency test.
- `apps/api/test/permissions.spec.ts`: new permission expectations.
- `apps/api/test/catalog.db.tenant-spec.ts`: SALES may now read categories.

## API added

- `GET /api/v1/stock` — current stock per product (base and readable units, per-batch stock for
  tracked products, `lowStock` flag). `GET /api/v1/stock/low-stock` — active products at or below the
  reorder level. `GET /api/v1/stock/movements` — ledger history filtered by product, type, and date
  range with pagination. `GET /api/v1/stock/batches/alerts?days=30` — near-expiry and expired batches
  that still hold stock. `POST /api/v1/stock/adjustments` — signed quantity in any active unit with a
  required reason. `POST /api/v1/stock/damage` — positive quantity recorded as a negative movement.
- `GET|POST /api/v1/suppliers`, `GET|PATCH /api/v1/suppliers/:id`,
  `POST /api/v1/suppliers/:id/archive`.
- `GET|POST /api/v1/purchases`, `GET|PATCH /api/v1/purchases/:id`,
  `POST /api/v1/purchases/:id/receive`, `POST /api/v1/purchases/:id/cancel`.
- `GET /api/v1/products/:id/units/:unitId/prices` — read-only price history.

## Tests run

- `pnpm --filter api prisma:generate` — passed.
- `pnpm --filter api exec prisma migrate deploy` — applied `20261021160000_stock_suppliers_purchases`
  to `smartdepo`; `pnpm --filter api exec prisma migrate status` reports "Database schema is up to date!".
- `pnpm format:check` — passed (Prettier was run on the files touched by this task first).
- `pnpm lint` — passed for API and web.
- `pnpm --filter api build` and `pnpm build` — passed for NestJS and Next.js.
- `pnpm test` — passed: API 16 suites / 98 tests; web 16 suites / 74 tests.
- `pnpm --filter api test:tenant` — passed: `smartdepo_test` schema reset and 9 migrations applied
  (22 tables), 7 suites / 93 tests.

Not run: no frontend work was in scope, so no manual browser walkthrough of the new endpoints; the
API was only exercised through the automated tests.

## Security check

- Every new endpoint has an explicit permission guard; there is no default-allow path. OWNER is a
  superset of STOCK_KEEPER, and SALES receives `STOCK_READ` and `CATEGORIES_READ` only.
- The depot id always comes from the access token through `PrismaService.runAsTenant`; no endpoint
  accepts a depot id, and every lookup is by id plus depot scope, so another depot's record is a 404.
- Wrong-depot tests cover supplier read, purchase read, stock adjustment, purchase creation with a
  foreign supplier, and price history; all return 404.
- Negative stock is blocked by the ledger service unless the depot setting `allowNegativeStock` is on.
  The database also enforces the ledger sign rules (`PURCHASE` positive, `SALE` and `DAMAGE`
  negative, quantity never zero, reason required for `ADJUSTMENT` and `DAMAGE`).
- Quantities use `Prisma.Decimal` and `NUMERIC(18,3)`; money uses `NUMERIC(14,2)` and decimal
  arithmetic. No JSON numbers or floating point are used for money or fractional quantities.
- Raw SQL exists only in `apps/api/src/prisma/stock-locks.ts`, with both ids parameterized.
- Audit entries are written for adjustments, damage, supplier create/update/archive, and purchase
  create/update/receive/cancel.
- No secrets, tokens, or real personal data were added; the test data is generated per run.

## Open issues / risks

- The concurrency protection uses a `SELECT ... FOR UPDATE` lock on the product row. It serializes
  writers for the same product inside one depot; a future high-volume implementation could switch to
  a per-product advisory lock. The lock is only effective for code paths that go through
  `StockLedgerService.recordMovement`; a direct insert into `stock_movements` would bypass it (the
  database CHECK constraints still apply).
- `products.cost_price` is the last purchase cost per base unit, not a weighted average, and it is
  overwritten by each received purchase line. The PRD does not specify which cost method is used.
- The unit cost on a purchase line is the cost of one **entered** unit (for example one carton). The
  per-base-unit cost shown in the response and stored on the movement and on `products.cost_price` is
  derived by dividing by the conversion factor and rounding to two decimals, so a carton cost of
  10.00 over 24 bottles becomes 0.42 per bottle.
- Draft purchases are editable and can be cancelled; received and cancelled purchases are immutable
  and corrections must go through stock adjustments, as required.
- Batch-tracked products require a batch number and expiry date on purchase lines. Manual adjustments
  and damage entries accept an optional `batchId` but do not require one, so a tracked product can
  still receive batchless adjustments.
- The stock list loads the depot's products and filters low-stock items in memory, so a very large
  catalog would need a different query shape.
- `price_history` still has no public update or delete endpoint, and the app role keeps table-level
  update and delete grants on it (same limitation as report 012).
- No frontend screens, seed data, supplier payables, delivery, or expiry suggestion (FR-22) are part
  of this task.

## Decisions needed from the human

- Confirm that "last purchase cost per base unit" (overwrite, not weighted average) is the cost method
  the reports phase should use.
- Confirm that the purchase line cost is entered per entered unit (for example per carton) and not
  per base unit.
- Confirm that SALES should keep reading categories, now that the permission was added.
- Confirm the endpoint shape for batch alerts: one endpoint returning `nearExpiry` and `expired`
  arrays is used today; separate endpoints are possible if the frontend prefers them.

## Status

ready for review

## Human review (filled in by the human only)
Decision: approved
Notes:
