# Task: Customers, invoices, payments, and credit

## FR IDs

- FR-23: manage customers (name, phone, address, type).
- FR-24: credit limit and payment terms per customer.
- FR-25: an invoice can be paid in full, paid in part, or left on credit.
- FR-26: record customer payments against invoices; the customer balance updates automatically.
- FR-27: overdue list and ageing (0-30, 31-60, and over 60 days).
- FR-28: customer statement with invoices, payments, and balance.
- FR-29: create an invoice with several product lines, units, quantities, and prices.
- FR-30: completing an invoice deducts stock and updates the customer balance in one transaction.
- FR-31: warn or block when the stock is not enough (configurable) and when the credit limit is
  reached.
- FR-32: discount per line or per invoice.
- FR-33 (partial): the invoice document data for printing is available; the PDF download and the
  thermal receipt layout stay for the later output task.
- FR-34: void an invoice with a reason, restricted by role, reversing the stock and the balance.
- FR-35: payment method recorded (cash, bank transfer, other).

## Summary

Added the sales side of the depot backend: customers with credit limits and payment terms, invoices
that are written in one transaction with their stock movements, payments that are allocated to
invoices, and the credit views. The server always recalculates the price and the totals, so a client
can never change them. Invoice numbers are sequential per depot and safe under concurrent requests,
and an idempotency key makes a retried create return the same invoice. Batch-tracked products are
sold first expiry first out, expired batches are never used, and an invoice fails with a clear
message when the usable batches do not hold enough stock. Only the owner may void an invoice, override
a price, or change the credit-limit setting; sales runs the day-to-day work and the stock keeper has
no access to any of it.

Two smaller changes came with this task: the cost per base unit and the cost on a stock movement now
use `NUMERIC(14,4)` so a small unit keeps its exact cost, and an adjustment or damage entry on a
batch-tracked product must name the batch it changes.

## Files changed

Schema and migrations:

- `apps/api/src/prisma/schema.prisma`: `CustomerType` is now `RETAIL | WHOLESALE`; new
  `PaymentStatus`, `DiscountType`, and `CreditLimitMode` enums; `customers.is_walk_in`;
  `sales_orders.payment_status`, `discount_type`, `discount_value`, `refund_due`, and
  `idempotency_key`; `sale_items.discount_type` and `discount_value`; the new `sale_item_batches`
  table; `depots.credit_limit_mode`; `products.cost_price` and `stock_movements.unit_cost` and
  `sale_items.cost_per_base_unit` at `NUMERIC(14,4)`; the new indexes.
- `apps/api/src/prisma/migrations/20261022120000_cost_precision/migration.sql`: the cost precision
  fix.
- `apps/api/src/prisma/migrations/20261022130000_customers_invoices_payments/migration.sql`: the
  enum change, the new columns and the `sale_item_batches` table, the CHECK constraints for
  positive amounts and valid values, the unique index for one walk-in customer and one idempotency
  key per depot, the new indexes, and the row-level security policy for the new table.

Common code:

- `apps/api/src/common/auth/permissions.ts`: the customer, invoice, payment, and credit permissions.
  SALES gets the read and write permissions, OWNER adds `INVOICES_VOID`, `INVOICES_PRICE_OVERRIDE`,
  and `CREDIT_SETTINGS_MANAGE`, STOCK_KEEPER gets nothing.
- `apps/api/src/common/audit/audit-actions.ts`: `CUSTOMER_CREATED`, `CUSTOMER_UPDATED`,
  `CUSTOMER_ARCHIVED`, `INVOICE_CREATED`, `INVOICE_VOIDED`, `PAYMENT_RECORDED`.
- `apps/api/src/common/tenant/tenant-models.ts`: `SaleItemBatch` added to the depot-scoped models.

Customers module:

- `apps/api/src/modules/customers/customers.module.ts`
- `apps/api/src/modules/customers/customers.controller.ts`
- `apps/api/src/modules/customers/customers.service.ts`: list, read, create, edit, archive, the
  customer statement, the walk-in customer, and the derived outstanding balances.
- `apps/api/src/modules/customers/dto/create-customer.dto.ts`
- `apps/api/src/modules/customers/dto/update-customer.dto.ts`
- `apps/api/src/modules/customers/dto/list-customers-query.dto.ts`
- `apps/api/src/modules/customers/dto/customer.dto.ts`

Invoices module:

- `apps/api/src/modules/invoices/invoices.module.ts`
- `apps/api/src/modules/invoices/invoices.controller.ts`
- `apps/api/src/modules/invoices/invoices.service.ts`: create, list, read, document, and void.
- `apps/api/src/modules/invoices/invoice-calculations.ts`: the pure line, discount, total, payment
  status, and outstanding helpers.
- `apps/api/src/modules/invoices/dto/create-invoice.dto.ts`
- `apps/api/src/modules/invoices/dto/list-invoices-query.dto.ts`
- `apps/api/src/modules/invoices/dto/invoice.dto.ts`
- `apps/api/src/modules/invoices/dto/void-invoice.dto.ts`

Payments module:

- `apps/api/src/modules/payments/payments.module.ts`
- `apps/api/src/modules/payments/payments.controller.ts`
- `apps/api/src/modules/payments/payments.service.ts`
- `apps/api/src/modules/payments/payment-allocations.ts`: the pure allocation and validation helpers.
- `apps/api/src/modules/payments/dto/record-payment.dto.ts`
- `apps/api/src/modules/payments/dto/list-payments-query.dto.ts`
- `apps/api/src/modules/payments/dto/payment.dto.ts`

Credit module:

- `apps/api/src/modules/credit/credit.module.ts`
- `apps/api/src/modules/credit/credit.controller.ts`
- `apps/api/src/modules/credit/credit.service.ts`: overview, overdue list, and ageing.
- `apps/api/src/modules/credit/credit-calculations.ts`: the pure ageing helpers.
- `apps/api/src/modules/credit/dto/credit.dto.ts`

Changes in earlier modules:

- `apps/api/src/modules/stock/stock-ledger.service.ts`: the ledger also checks the batch stock, so a
  sale cannot take more from a batch than the batch holds.
- `apps/api/src/modules/stock/stock.service.ts`: an adjustment or a damage entry on a batch-tracked
  product must name the batch.
- `apps/api/src/modules/depots/depot-settings.service.ts` and its DTOs: the depot credit-limit mode
  (`WARN` or `BLOCK`).
- `apps/api/src/prisma/invoice-locks.ts`: the advisory lock that serialises the invoice number of a
  depot.
- `apps/api/src/app.module.ts`: registers `CustomersModule`, `InvoicesModule`, `PaymentsModule`, and
  `CreditModule`.

Documentation:

- `README.md`: the new endpoints, the invoice and payment rules, and the credit views.
- `docs/reports/020-customers-invoices-payments.md`: this report.

## Tests run

- `pnpm format:check` — passed.
- `pnpm lint` — passed for API and web.
- `pnpm --filter api build` and `pnpm build` — passed for NestJS and Next.js.
- `pnpm test` — passed: API 19 suites / 117 tests; web 21 suites / 102 tests.
- `pnpm --filter api test:tenant` — passed: the test database is reset and migrated (23 tables),
  8 suites / 111 tests.
- The new database-backed sales spec was run nine times in a row to make sure the concurrency tests
  are stable.

New tests:

- `apps/api/test/invoice-calculations.spec.ts`: line totals, rounding, fixed and percentage
  discounts, the invoice total, the payment status, and the outstanding amount.
- `apps/api/test/payment-allocations.spec.ts`: oldest invoice first, skipping paid invoices, and the
  rules that reject an allocation that is too big.
- `apps/api/test/credit-calculations.spec.ts`: the days overdue and the ageing buckets.
- `apps/api/test/sales.db.tenant-spec.ts`: 18 database-backed tests for the customers, invoices,
  payments, credit views, the credit limit, the walk-in customer, the invoice document, the batch
  allocation, the idempotency key, two invoices racing for the last stock, two invoices created at
  the same time, the void, and the wrong-depot cases.

Not run: no live manual check against a running API and browser was done for this backend task; the
behaviour was verified through the automated tests only.

## Security check

- Every new endpoint has an explicit permission guard. SALES can read and write customers, invoices,
  payments, and the credit views; the stock keeper gets 403 on all of them, and the void, the price
  override, and the credit setting are owner only. The price override is checked inside the invoice
  service with the same permission map, so it cannot be reached through another route.
- The depot id always comes from the access token. The wrong-depot tests cover reading another
  depot's customer, invoicing another depot's customer, invoicing another depot's product, and paying
  another depot's customer; all return 404.
- The invoice is written in one transaction: the invoice, the lines, the batch allocation, the stock
  movements, the checkout payment, and the audit entry either all commit or all roll back. The stock
  ledger locks the product row, so two invoices cannot sell the same last bottle.
- The money never comes from the client: the unit price comes from the product price of the
  customer type, the line and invoice totals are recalculated with `Prisma.Decimal`, and the invoice
  stores the unit price and the cost per base unit of that moment.
- The customer balance is always derived from the invoices and the payment allocations; nothing is
  typed in by hand and no balance column exists.
- The invoice number is unique per depot through a database index and sequential through an advisory
  lock inside the transaction.
- The idempotency key is unique per depot. A repeated request returns the invoice that already
  exists instead of writing a second one.
- Audit entries are written for customer create, edit, and archive, for every invoice, for every
  void with its reason, and for every payment with its allocations.
- No hard delete endpoint exists for customers, invoices, payments, or allocations. A voided invoice
  keeps its rows and reports the money that still has to be refunded.
- The database CHECK constraints keep the amounts positive, the quantities positive, the discounts
  non-negative, the credit limit and the payment terms non-negative, and a voided invoice always has
  a reason. The new table has a row-level security policy.
- No raw SQL outside `apps/api/src/prisma/**`; the advisory lock uses a parameterized key. No secrets
  or real personal data were added.

## Open issues / risks

- The customer type enum changed from `RETAILER | RESTAURANT | OTHER` to `RETAIL | WHOLESALE`. Any
  client that stores the old values has to be updated, and the migration rewrites the enum because
  the old values cannot be mapped one to one.
- The walk-in customer is created the first time a depot lists its customers, not when the depot is
  approved. A depot that never opens the customer list has no walk-in customer yet.
- The credit-limit check uses the outstanding balance of the customer plus the new invoice. A
  customer with no credit limit is never limited, and the check only runs on the invoice path, not
  when a payment is recorded.
- The batch allocation and the stock check happen in two steps. The batch allocation is computed
  before the stock movements are written, and the ledger re-checks the batch stock under the product
  lock. If two invoices sell the same batch at the same time, the second one fails with "Insufficient
  stock in the selected batch" instead of a batch specific message.
- The first version of the invoice number lock only computed a hash and took no lock. The
  concurrency test caught it as a 500 on the unique index, and the lock now uses
  `pg_advisory_xact_lock` inside the transaction.
- The invoice document endpoint returns the data for the print view. The PDF, the thermal receipt, and
  the logo URL are not part of this task.
- A voided invoice keeps its payments and reports the amount as `refundDue`. Paying that money back
  to the customer and writing it out of the depot is a depot decision that is not modelled yet.
- The invoice list cannot be filtered by the invoice status "draft" because invoices are always
  written as completed. Draft invoices are not part of this task.
- The customer list and the invoice list use a page size of 20 by default and the payment list does
  the same. A depot with many customers needs a search that is already there.

## Decisions needed from the human

- Confirm that the customer type should be exactly `RETAIL` and `WHOLESALE` and that the old
  `RETAILER`, `RESTAURANT`, and `OTHER` values may be dropped.
- Confirm that the invoice number format `INV-000123` (six digits, per depot) is the wanted one.
- Confirm that the price override stays owner only, and that the credit-limit mode starts at `WARN`.
- Confirm that a void keeps the payments and only reports the refund due, instead of writing a
  refund document.
- Confirm that the walk-in customer should be created when the depot is approved instead of on the
  first customer list.

## Status

ready for review

## Human review (filled in by the human only)
Decision: approved
Notes:
