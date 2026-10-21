# Task: Frontend for customers, invoices, payments, and credit

## FR IDs

- FR-23: manage customers (name, phone, address, type).
- FR-24: credit limit and payment terms per customer.
- FR-25: an invoice can be paid in full, paid in part, or left on credit.
- FR-26: record customer payments against invoices; the customer balance updates automatically.
- FR-27: overdue list and ageing (0-30, 31-60, and over 60 days).
- FR-28: customer statement with invoices, payments, and balance.
- FR-29: create an invoice with several product lines, units, quantities, and prices.
- FR-30: completing an invoice deducts stock and updates the customer balance in one transaction.
- FR-31: warn or block when the stock is not enough.
- FR-32: discount per line or per invoice.
- FR-33 (partial): the invoice screen and the invoice detail are ready for the print view; the PDF and
  the thermal receipt are still later work.
- FR-34: void an invoice with a reason, restricted by role.
- FR-35: payment method recorded (cash, bank transfer, other).
- FR-3: role-aware navigation and client route guards for the new screens.

## Summary

Added the sales side of the depot frontend on top of the API from report 020. The invoice screen is
built for speed: the customer is picked first (the walk-in customer is the default), products are
searched by name or SKU, the price of the unit comes from the API for the price list of the customer,
and a line is added with Enter while the arrow keys move through the results. Every line and the
invoice can carry a discount (amount or percent), the running totals are calculated with decimal
strings only, and the answer of the server is what is shown after saving. The checkout takes the
money that is paid now or leaves the invoice on credit, the errors of the API are translated, and every
attempt carries an idempotency key that is reused on a retry so a double click cannot write two
invoices. The invoice list, the customer screens, and the credit screens complete the set. All new
text is in English and Khmer, and the invoice screen was checked on a phone.

## Files changed

New pages:

- `apps/web/src/app/(app)/invoices/page.tsx`: the invoice list.
- `apps/web/src/app/(app)/invoices/new/page.tsx`: the invoice screen and the detail of the invoice
  that was just saved.
- `apps/web/src/app/(app)/customers/page.tsx`: the customer list.
- `apps/web/src/app/(app)/customers/[id]/page.tsx`: the customer detail.
- `apps/web/src/app/(app)/credit/page.tsx`: the credit views.

Invoice feature:

- `apps/web/src/features/invoices/invoice-screen.tsx`: the customer picker, the product search with
  the keyboard, the lines, the discounts, the totals, the checkout, and the idempotency key.
- `apps/web/src/features/invoices/invoice-draft.ts`: the pure helpers for the line totals, the
  discounts, the base quantity, the usable batches, and the idempotency key.
- `apps/web/src/features/invoices/invoice-error.ts`: the translation of the answers of the API.
- `apps/web/src/features/invoices/invoices-manager.tsx`: the list with its filters, the detail, and
  the void flow.
- `apps/web/src/features/invoices/invoice-detail.tsx`: the lines, the discounts, the totals, the
  payments, the status, and the void button.
- `apps/web/src/features/invoices/void-invoice-dialog.tsx`: the void dialog with the reason.

Customer feature:

- `apps/web/src/features/customers/customers-manager.tsx`: the list, the filters, the archive, and
  the link to the customer page.
- `apps/web/src/features/customers/customer-form.tsx`: the create and edit form.
- `apps/web/src/features/customers/customer-detail.tsx`: the balance, the overdue amount, the
  statement, the invoices, and the record payment button.
- `apps/web/src/features/customers/record-payment-dialog.tsx`: the method, the amount, and the
  allocation (oldest invoice first or the invoices the user picks).

Credit feature:

- `apps/web/src/features/credit/credit-manager.tsx`: the overview, the ageing buckets, and the
  overdue list with links to the customers.

Shared code:

- `apps/web/src/lib/api-client.ts`: the typed clients for customers, invoices, payments, and the
  credit views.
- `apps/web/src/lib/types.ts`: the customer, invoice, payment, statement, ageing, and credit types.
- `apps/web/src/lib/decimal.ts`: the money helpers that follow the currency of the depot.
- `apps/web/src/lib/format.ts`: `moneyDecimals` and the currency aware `formatMoney`.
- `apps/web/src/lib/navigation.ts`: the Invoices, Customers, and Credit entries with their roles and
  the route guards.
- `apps/web/src/components/app-shell.tsx`: the icons of the new navigation entries.
- `apps/web/src/app/globals.css`: the invoice layout, the product result list, the dialog body, and
  the `.button--quiet` variant for the light pages.
- `apps/web/src/i18n/en.json` and `apps/web/src/i18n/km.json`: every new label in both languages.

Tests:

- `apps/web/src/features/invoices/invoice-draft.spec.ts`: the line totals, the discounts, the
  rounding, the base quantity, the usable batches, and the idempotency key.
- `apps/web/src/features/invoices/invoice-screen.spec.tsx`: the invoice screen, the keyboard entry,
  the price override, the checkout payment, and the reused idempotency key after a failure.
- `apps/web/src/features/invoices/invoices-manager.spec.tsx`: the void flow with the reason and the
  refund due.
- `apps/web/src/features/customers/record-payment-dialog.spec.tsx`: the payment dialog, the manual
  allocation, and the errors of the API.
- `apps/web/src/lib/navigation.spec.ts`: the navigation and the route guards of every role.
- `apps/web/src/lib/decimal.spec.ts`: the money display that follows the currency.

## Tests run

- `pnpm format:check` — passed.
- `pnpm lint` — passed for API and web.
- `pnpm test` — passed: API 19 suites / 117 tests; web 25 suites / 128 tests.
- `pnpm build` — passed for NestJS and Next.js; the build lists `/invoices`, `/invoices/new`,
  `/customers`, `/customers/[id]`, and `/credit`.
- `pnpm --filter web exec tsc --noEmit -p tsconfig.json` — passed.

### Live check against the running backend

Yes, this task was tested against the live local stack: the API on `http://localhost:3001` and the
Next.js app on `http://localhost:3000`. A throwaway depot ("Sales UI Depot") was registered through
the API, approved with the seeded Platform Admin, and filled with a priced product, opening stock,
a wholesale customer with a credit limit, and a sales account. The screens were driven with a
temporary Playwright script (deleted afterwards) and checked in English and Khmer at 1440 px and at
iPhone 13 width:

- The invoice screen picked the walk-in customer, showed the retail price of both units, added a line
  with Enter, calculated the total, took a payment of 10 at checkout, and saved the invoice. The
  customer balance went from 0 to 8 KHR, so the invoice, the stock, and the payment all went through
  the API.
- The invoice list, the customer list, the customer detail, and the credit screens loaded with their
  data.
- The Khmer view renders with Noto Sans Khmer, including the customer picker, the product results,
  the lines, the totals, and the checkout.
- The phone layout stacks the panels, the buttons go full width, and the product results stay
  readable.
- A sales account saw only Dashboard, Products, Stock, Invoices, Customers, Credit, Settings, and
  Change password, and the void button was not on the invoice detail.

The live check found two problems that are fixed: the customer type label was a flat i18n key that
did not resolve (it is now `customers.types.RETAIL` and `customers.types.WHOLESALE`), and the ghost
button was white on the light pages (there is now a `.button--quiet` variant, and the products screen
uses it for its clear button too).

The sample depot and its data are still in the development database and can be deleted whenever the
human wants.

## Security check

- The screens only call the endpoints of report 020 with the permissions of the API; the client does
  not decide what is allowed. The navigation and the route guards follow the same roles, so the stock
  keeper and the delivery staff see none of the new screens.
- Only the owner sees the void button, the price override, and the credit settings. The price field is
  disabled for sales, and the void endpoint is owner only on the server as well.
- The client never calculates the price of a line or the credit limit itself. It shows the price of
  the API, the totals are a preview, and the invoice of the server replaces them after saving. The
  credit warning of the server is shown as it is.
- The idempotency key is generated in the browser and sent with the invoice, so a double click or a
  retry cannot write two invoices. A failed attempt keeps its key until the draft changes.
- Money and quantities are handled as decimal strings and scaled `BigInt` values; the browser never
  converts an amount or a quantity to a JavaScript number.
- No token is stored in the browser beyond the existing in-memory access token and the httpOnly
  refresh cookie; the new screens use the existing API client.
- No secrets, tokens, or real personal data were added; the live check used fake sample data.

## Open issues / risks

- The invoice screen searches the stock endpoint, so a product with no stock and no price never shows
  up in the results. A depot with a large catalog may want a search that also covers archived
  products.
- The product results show one row per unit. A product with many units makes the list long, and the
  row of the unit is what gets added to the invoice.
- The client warns when the wanted quantity is bigger than the stock or than the usable batches, but
  the server decides. The client cannot know about the stock that another invoice takes at the same
  moment.
- The money follows the currency of the depot: a whole amount in KHR is shown without decimals, and an
  amount with cents keeps them. A price per unit always keeps two decimals, because a bottle can
  cost 1.50 KHR. The human should confirm this rule for the demo.
- The credit limit warning of the server is shown in English because the API sends it as a sentence.
  A structured error code would let the UI translate it.
- The customer list loads up to 100 customers and filters them in the browser. A depot with more
  customers needs the server search.
- The invoice list loads the invoices of one page at a time, but the customer page loads up to 100
  invoices of that customer for the statement and the overdue amount.
- The PDF, the thermal receipt, and the print stylesheet are not part of this task; the invoice
  detail has everything the print view needs.
- The customer type of the API changed in report 020; the frontend uses `RETAIL` and `WHOLESALE`.

## Decisions needed from the human

- Confirm the money display rule: whole amounts in KHR without decimals, amounts with cents keep
  them, and USD always shows two decimals.
- Confirm that the product results should list one row per unit, or that the base unit should be
  enough.
- Confirm that the credit limit warning may stay in English until the API sends a code.
- Confirm that the "Sales UI Depot" sample data should be deleted from the development database.

## Status

ready for review

## Human review (filled in by the human only)
Decision: approved
Notes:
