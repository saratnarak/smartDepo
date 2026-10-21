# Task: Frontend for categories, products, units, and prices

## FR IDs

- FR-11: categories page with list, create, edit, and archive.
- FR-12: products list with search, category/status filters, sorting, pagination, and a conditional low-stock marker.
- FR-13: product form with base unit and extra units with conversion factors, validation, live preview, and readable quantities.
- FR-16: retail and wholesale price editing per unit with a current-price/last-change history section.
- FR-8: product image upload through the existing `ImageUpload` component.

These IDs follow the task instruction and report 012. The PRD section 6.2 table uses a different numbering for the same features (FR-11 products, FR-12 units, FR-13 prices, FR-16 search/filter). See "Decisions needed".

## Summary

Added the catalog frontend: a categories page, a role-aware products list, a create/edit product form, a unit editor with decimal conversion previews, and a price editor with owner-only editing. Creating a product immediately switches the form to edit mode so the image, extra units, and prices can be added. Navigation now exposes Products to OWNER, SALES, and STOCK_KEEPER and Categories to OWNER and STOCK_KEEPER. All new text exists in `en.json` and `km.json`. Money and quantities are handled as decimal strings or scaled `BigInt`, never JavaScript floating point.

## Files changed

New files:

- `apps/web/src/app/(app)/categories/page.tsx`
- `apps/web/src/app/(app)/products/page.tsx`
- `apps/web/src/features/categories/categories-manager.tsx`
- `apps/web/src/features/products/unit-drafts.ts`
- `apps/web/src/features/products/unit-drafts.spec.ts`
- `apps/web/src/features/products/unit-editor.tsx`
- `apps/web/src/features/products/price-editor.tsx`
- `apps/web/src/features/products/price-editor.spec.tsx`
- `apps/web/src/features/products/product-form.tsx`
- `apps/web/src/features/products/product-form.spec.tsx`
- `apps/web/src/features/products/products-manager.tsx`
- `apps/web/src/features/products/products-manager.spec.tsx`
- `apps/web/src/lib/decimal.ts`
- `apps/web/src/lib/decimal.spec.ts`

Modified files:

- `apps/web/src/lib/types.ts`: catalog types and the optional `currentStock` and `imageKey` fields.
- `apps/web/src/lib/api-client.ts`: category, product, unit, and price calls.
- `apps/web/src/lib/format.ts`: decimal-string money formatter using `BigInt` grouping.
- `apps/web/src/lib/navigation.ts`: catalog navigation entries and route guards.
- `apps/web/src/lib/navigation.spec.ts`: updated role expectations.
- `apps/web/src/components/app-shell.tsx`: products and categories icons.
- `apps/web/src/components/image-upload.tsx`: optional `hasStoredImage` probe for responses that do not expose the stored key.
- `apps/web/src/i18n/en.json`: catalog, unit, price, validation, and navigation text.
- `apps/web/src/i18n/km.json`: Khmer translations for the same keys.
- `apps/web/src/app/globals.css`: catalog filters, product table, unit editor, price editor, checkbox row, and phone breakpoints.

## Tests run

- `pnpm format:check` - passed: "All matched files use Prettier code style!".
- `pnpm lint` - passed for API and web.
- `pnpm test` - passed:
  - API: 14 suites, 87 tests.
  - Web: 16 suites, 66 tests.
- `pnpm --filter web build` - passed. Next.js built all routes, including `/categories` and `/products`.
- Temporary Playwright layout check (not committed) against the dev server with mocked API responses:
  - Khmer products list at 390×844: no document overflow (`scrollWidth` 390, viewport 390), no card overlap.
  - English products list at 1280×900: no document overflow or overlap.
  - Khmer categories list at 390×844: no document overflow or overlap.
  - Khmer product form at 390×844: unit rows, price cards, and inputs stacked without overlap.
  - Screenshots were written to `/tmp/smartdepo-products-km-phone.png`, `/tmp/smartdepo-products-km-phone-form.png`, `/tmp/smartdepo-products-en-desktop.png`, and `/tmp/smartdepo-categories-km-phone.png`.
- `pnpm --filter api test:tenant` was not rerun: this task changed no API, schema, migration, guard, or tenant-scope code. The tenant coverage from reports 012 and 013 remains unchanged.

## Security check

- Role-aware UI only; server guards remain authoritative.
  - `SALES` sees the product list and prices but no add/edit/archive actions and no price inputs.
  - `STOCK_KEEPER` manages products and units, sees prices read-only, and gets no price inputs or save buttons.
  - `OWNER` can edit prices.
  - `DELIVERY` has no Products or Categories navigation and `canAccessPath` blocks both routes.
- `canAccessPath` guards `/products` and `/categories`; the API still enforces permissions for every request.
- The client never sends a depot id. All catalog requests rely on the existing token-scoped API.
- Categories are not requested for SALES because the API forbids it; the sales category filter is built from the current product page instead.
- No floating-point math on money, quantities, or conversion factors:
  - Quantities and factors use decimal-string parsing with scaled `BigInt`.
  - Readable quantities and unit previews do not use `Number`.
  - Money formatting groups the integer part with `Intl.NumberFormat` on a `BigInt` and keeps two fraction digits as text.
- No new backend endpoints, no new dependencies, and no changes to tenant scope or row-level security.
- No cross-tenant API test was added because no API code changed; existing API tenant tests still cover these endpoints.

## Open issues / risks

- **Price history has no read endpoint.** The UI shows the current retail/wholesale price per unit, its last-changed date, and a translated note that full history requires a history endpoint. Report 012 already listed this as an open question.
- **The product response has no stock field.** The low-stock marker is implemented behind an optional `currentStock` field and will stay hidden until a stock API adds it. The Playwright check simulated the field.
- **The product response has no `imageKey`.** `ImageUpload` now accepts `hasStoredImage` and probes the read-url endpoint on the edit form; a 404 is treated as "no image". If `imageKey` is later added to the product response, pass it directly instead.
- **SALES cannot read product image URLs.** The storage read endpoint allows OWNER and STOCK_KEEPER only. The edit form is not shown to SALES, so this does not break the current screens; product thumbnails in the list would require a permission review.
- **SALES category filtering is page-limited.** The categories endpoint forbids SALES, so the filter only includes categories present in the loaded product page.
- **Archived products still open the edit form.** Unit and price writes are rejected by the API, and the error is shown. Disabling the unit/price sections for archived products would be a small follow-up.
- **Prices cannot be cleared.** The API has a set-price endpoint but no delete-price endpoint; an empty amount is rejected in the UI.
- **Money always shows two decimals.** This matches `NUMERIC(14,2)` storage, including KHR; confirm whether KHR should be displayed without decimals.
- **The layout check used mocked API data.** The development seed script is still a Phase 4 placeholder, so the check verifies i18n and responsive layout, not a live end-to-end data path.
- **Real R2 upload was not exercised again.** The product image path reuses the storage integration from report 013, which was verified with the in-memory fake provider only.

## Decisions needed from the human

- Add a price-history read endpoint? If yes, in which phase?
- Add `currentStock` (or a low-stock flag) to the products list response, or wait for the stock module?
- Allow SALES to list categories for the filter, or accept the page-derived filter?
- Confirm the FR numbering used in the task/report 012 versus the PRD table.
- Should archived products hide the unit and price editors entirely?
- Should KHR prices show zero decimals, or keep the stored two-decimal format?

## Human review (filled in by the human only)
Decision: approved
Notes:
