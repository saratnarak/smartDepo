# Task: Categories, products, units, and prices

## FR IDs

- FR-11: depot categories with create, edit, archive, and list.
- FR-12: products with category, depot-unique SKU, base unit, reorder level, and batch/expiry flag.
- FR-13: product units and decimal conversion between units and the base unit.
- FR-16: retail and wholesale prices per product unit with price history.
- FR-50 groundwork: audit entries for catalog and price changes; the audit viewer is still later work.

## Summary

Added the depot catalog backend: categories, products, product units, shared decimal conversion helpers, and retail/wholesale prices with immutable price history. Product listing supports name/SKU search, category and archived filters, pagination, and sorting. The database migration adds price history, RLS, CHECK constraints, and search indexes. OWNER and STOCK_KEEPER manage the catalog; SALES can read products and prices; only OWNER can change prices.

## Files changed

Schema and migrations:

- `apps/api/src/prisma/schema.prisma`: `PriceHistory` model and relations; catalog and search indexes.
- `apps/api/src/prisma/migrations/20261021120000_catalog_products_units_prices/migration.sql`: price history table, CHECK constraints, partial unique base-unit indexes, RLS, and catalog indexes.
- `apps/api/src/prisma/migrations/20261021130000_price_histories_plural/migration.sql`: renames the history table to the plural `price_histories`.
- `apps/api/src/prisma/migrations/20261021140000_catalog_trgm_indexes/migration.sql`: `pg_trgm` extension and GIN indexes for case-insensitive substring search.
- `apps/api/src/prisma/row-level-security.sql`: reference copy updated for `price_histories`.

Common code:

- `apps/api/src/common/units/quantity.ts`: decimal conversion to base units, validation helpers, and readable base-quantity formatting.
- `apps/api/src/common/validation/decimal.ts`: quantity, conversion-factor, and money string patterns.
- `apps/api/src/common/validation/transforms.ts`: shared uppercase and boolean transforms.
- `apps/api/src/common/auth/permissions.ts`: catalog and price permissions.
- `apps/api/src/common/audit/audit-actions.ts`: category, product, unit, and price audit actions.
- `apps/api/src/common/tenant/tenant-models.ts`: `PriceHistory` added to the tenant-scoped models.

Categories module:

- `apps/api/src/modules/categories/categories.module.ts`
- `apps/api/src/modules/categories/categories.controller.ts`
- `apps/api/src/modules/categories/categories.service.ts`
- `apps/api/src/modules/categories/dto/category.dto.ts`
- `apps/api/src/modules/categories/dto/create-category.dto.ts`
- `apps/api/src/modules/categories/dto/update-category.dto.ts`
- `apps/api/src/modules/categories/dto/list-categories-query.dto.ts`

Products module, including units and prices:

- `apps/api/src/modules/products/products.module.ts`
- `apps/api/src/modules/products/products.controller.ts`
- `apps/api/src/modules/products/products.service.ts`
- `apps/api/src/modules/products/product-select.ts`
- `apps/api/src/modules/products/product-units.controller.ts`
- `apps/api/src/modules/products/product-units.service.ts`
- `apps/api/src/modules/products/product-prices.controller.ts`
- `apps/api/src/modules/products/product-prices.service.ts`
- `apps/api/src/modules/products/dto/create-product.dto.ts`
- `apps/api/src/modules/products/dto/update-product.dto.ts`
- `apps/api/src/modules/products/dto/list-products-query.dto.ts`
- `apps/api/src/modules/products/dto/create-product-unit.dto.ts`
- `apps/api/src/modules/products/dto/update-product-unit.dto.ts`
- `apps/api/src/modules/products/dto/set-price.dto.ts`
- `apps/api/src/modules/products/dto/product.dto.ts`
- `apps/api/src/modules/products/dto/price.dto.ts`

Wiring and documentation:

- `apps/api/src/app.module.ts`: registers `CategoriesModule` and `ProductsModule`.
- `README.md`: catalog endpoints, permissions, decimal conversion, price history, and phase status.
- `docs/reports/012-categories-products-units-prices.md`: this report.

Tests:

- `apps/api/test/quantity.spec.ts`: conversion, fractional kilograms, rounding, readable formatting, and invalid factors.
- `apps/api/test/permissions.spec.ts`: catalog permissions and OWNER/STOCK_KEEPER/SALES boundaries.
- `apps/api/test/catalog.db.tenant-spec.ts`: database-backed catalog API and tenant tests.
- `apps/api/test/auth.db.tenant-spec.ts`: OpenAPI path assertions for the new controllers.

## Tests run

- `pnpm --filter api exec prisma format` — passed.
- `pnpm --filter api exec prisma validate` — passed.
- `pnpm --filter api prisma:generate` — passed.
- `pnpm --filter api exec prisma migrate deploy` — applied the three catalog migrations to `smartdepo`; `prisma migrate status` reports all 7 migrations up to date.
- `pnpm format:check` — passed.
- `pnpm lint` — passed for API and web.
- `pnpm test` — passed: API 12 suites / 80 tests; web 10 suites / 38 tests.
- `pnpm --filter api test:tenant` — passed: test database rebuilt and migrated (22 tables), 5 suites / 77 tests.
- `pnpm build` — passed for NestJS and Next.js.

Database verification on `smartdepo`:

- `price_histories` has RLS enabled and the `tenant_isolation` policy.
- The app role has SELECT/INSERT/UPDATE/DELETE on `price_histories`.
- CHECK constraints are present for non-negative reorder levels, positive conversion factors, base-unit factor 1, non-negative prices, and non-negative price history amounts.
- Partial unique indexes enforce one base unit and one factor-1 unit per product.
- `pg_trgm` is installed and the category/product name and product SKU GIN indexes exist.

## Security check

- Catalog endpoints are guarded with explicit permissions; no endpoint relies on UI hiding.
- OWNER inherits all STOCK_KEEPER catalog permissions; SALES receives product read only; STOCK_KEEPER cannot change prices; only OWNER has `PRICES_MANAGE`.
- Every lookup and write uses the token-derived depot through `PrismaService.runAsTenant`.
- Wrong-depot tests cover categories, products, units, and prices and expect 404/empty results.
- `price_histories` has RLS and is included in the tenant model list.
- Money and quantities use `Prisma.Decimal`; JSON numbers are not used for decimal fields. Database columns remain `NUMERIC`.
- Database CHECK constraints and partial unique indexes protect the invariants even if a service check is bypassed.
- Audit entries are written for category, product, unit, and price changes. Price changes also create a `price_histories` row.
- No raw SQL outside `apps/api/src/prisma/**`; no secrets, tokens, or real personal data were added.

## Open issues / risks

- `products.isActive` is enforced by the catalog endpoints for new units and price changes. There are no invoice or purchase modules yet, so those future services must also reject archived products when they are built.
- The “exactly one base unit” rule is enforced by product creation, a partial unique index, and the base-factor CHECK. A direct database insert could still create a product with no base unit; the API always creates one, and the product view would fail closed if that invariant were broken.
- Price history has no public update/delete endpoint. The app role still has table-level update/delete grants, so a future service must not expose those operations; a restrictive RLS policy could be added if immutable history must be enforced at the database layer.
- Substring search uses `pg_trgm` GIN indexes. A deployment database must allow the trusted `pg_trgm` extension; the local development and test databases did.
- The catalog modules put units and prices under `modules/products` as nested product resources; they do not have separate top-level module folders.
- No frontend catalog screens, seed data, supplier payables, or delivery features are included in this task.

## Decisions needed from the human

- Confirm that SALES should not list categories directly, and only see the category embedded in product responses.
- Confirm whether a price-history read endpoint is needed before the reports phase.

## Status

ready for review

## Human review (filled in by the human only)
Decision: approved
Notes:
