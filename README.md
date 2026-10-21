# SmartDepo

Multi-tenant web platform for depots (wholesale distributors). Next.js frontend, NestJS API,
PostgreSQL through Prisma.

The product requirements live in [`docs/PRD.md`](docs/PRD.md); engineering rules live in
[`AGENTS.md`](AGENTS.md).

## Repository layout

```
apps/api     NestJS REST API (prefix /api/v1)
apps/web     Next.js App Router frontend
scripts/seed sample data generator (Phase 4)
docs         PRD, and later the SRS and security test report
```

## Prerequisites

- Node.js 22 or newer (CI uses 24; Prisma 7 currently warns on Node 26, so Node 24 LTS is recommended)
- pnpm 12 (`corepack enable` uses the version pinned in `package.json`)
- PostgreSQL running locally (the developer manages it with pgAdmin). Docker Compose is optional and
  only used when a containerized database is preferred.

## Local setup

```bash
pnpm install
cp .env.example .env          # then replace the placeholder values
# Create the roles/databases once (see "Database roles and grants" below)
pnpm --filter api prisma migrate deploy   # apply migrations as smartdepo_owner
pnpm --filter api prisma:generate         # Prisma client (also runs before build/test)
pnpm --filter api seed:platform-admin     # reads PLATFORM_ADMIN_* from .env
pnpm --filter api start:dev               # http://localhost:3001/api/v1/health
pnpm --filter web dev                     # http://localhost:3000
```

The API reads `.env` from the repository root and needs three URLs:

| Variable                 | Role                                         | Database         | Used by                         |
| ------------------------ | -------------------------------------------- | ---------------- | ------------------------------- |
| `DATABASE_URL`           | `smartdepo_app` (no superuser, no BYPASSRLS) | `smartdepo`      | the running API and tests       |
| `MIGRATION_DATABASE_URL` | `smartdepo_owner`                            | `smartdepo`      | Prisma CLI migrations           |
| `TEST_DATABASE_URL`      | `smartdepo_app`                              | `smartdepo_test` | `pnpm --filter api test:tenant` |

The web app calls `/api/v1` by default. Next.js rewrites that path to `API_PROXY_TARGET`
(`http://localhost:3001` by default), so the browser talks to one origin. The auth route handlers use
`API_INTERNAL_URL` when it is set, otherwise `API_PROXY_TARGET`. If the API is on another host, copy
the web values into `apps/web/.env.local`; the web app does not read the root `.env` automatically.

### Database roles and grants

Migrations run as `smartdepo_owner`, which owns the tables; the API runs as `smartdepo_app`, which is
not the owner and has no `BYPASSRLS`, so row-level security applies. A database administrator sets
this up once (adjust database names as needed):

```sql
CREATE ROLE smartdepo_owner LOGIN PASSWORD '...' NOSUPERUSER CREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE smartdepo_app   LOGIN PASSWORD '...' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE DATABASE smartdepo      OWNER smartdepo_owner;
CREATE DATABASE smartdepo_test OWNER smartdepo_owner;

-- Run the following in both databases as a superuser or as smartdepo_owner:
ALTER SCHEMA public OWNER TO smartdepo_owner;
GRANT USAGE ON SCHEMA public TO smartdepo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO smartdepo_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO smartdepo_app;
ALTER DEFAULT PRIVILEGES FOR ROLE smartdepo_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO smartdepo_app;
ALTER DEFAULT PRIVILEGES FOR ROLE smartdepo_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO smartdepo_app;
```

`CREATEDB` on `smartdepo_owner` is only needed by `prisma migrate dev`, which creates a temporary
shadow database. `prisma migrate deploy` (used in CI and for the test database) does not need it.

Database-backed tests refuse to run unless the test database name ends with `_test`. The
`test:tenant` script applies migrations to `smartdepo_test`, truncates its tables, grants the app role
access, and only then runs Jest.

## Authentication and platform admin

Public registration and login live under `/api/v1/auth`. Registration creates a PENDING depot and its
OWNER; the owner cannot log in until a platform admin approves the depot. Login accepts an email or
phone plus the password and returns a short-lived access token and a refresh token. Both tokens carry
the user id, role, and depot id (the depot id is null for the platform admin). Passwords are hashed
with bcrypt.

| Method | Path                                              | Access                     |
| ------ | ------------------------------------------------- | -------------------------- |
| POST   | `/api/v1/auth/register`                           | Public, rate limited       |
| POST   | `/api/v1/auth/login`                              | Public, rate limited       |
| POST   | `/api/v1/auth/refresh`                            | Public, rate limited       |
| GET    | `/api/v1/auth/me`                                 | Any authenticated role     |
| POST   | `/api/v1/auth/change-password`                    | Any authenticated role     |
| GET    | `/api/v1/users`                                   | OWNER                      |
| POST   | `/api/v1/users`                                   | OWNER                      |
| PATCH  | `/api/v1/users/:id`                               | OWNER                      |
| POST   | `/api/v1/users/:id/deactivate`                    | OWNER                      |
| POST   | `/api/v1/users/:id/reset-password`                | OWNER                      |
| GET    | `/api/v1/depot/settings`                          | Any depot role             |
| PATCH  | `/api/v1/depot/settings`                          | OWNER                      |
| GET    | `/api/v1/categories`                              | OWNER, STOCK_KEEPER, SALES |
| POST   | `/api/v1/categories`                              | OWNER, STOCK_KEEPER        |
| PATCH  | `/api/v1/categories/:id`                          | OWNER, STOCK_KEEPER        |
| POST   | `/api/v1/categories/:id/archive`                  | OWNER, STOCK_KEEPER        |
| GET    | `/api/v1/products`                                | OWNER, STOCK_KEEPER, SALES |
| GET    | `/api/v1/products/:id`                            | OWNER, STOCK_KEEPER, SALES |
| POST   | `/api/v1/products`                                | OWNER, STOCK_KEEPER        |
| PATCH  | `/api/v1/products/:id`                            | OWNER, STOCK_KEEPER        |
| POST   | `/api/v1/products/:id/archive`                    | OWNER, STOCK_KEEPER        |
| POST   | `/api/v1/products/:id/units`                      | OWNER, STOCK_KEEPER        |
| PATCH  | `/api/v1/products/:id/units/:unitId`              | OWNER, STOCK_KEEPER        |
| POST   | `/api/v1/products/:id/units/:unitId/archive`      | OWNER, STOCK_KEEPER        |
| PUT    | `/api/v1/products/:id/units/:unitId/prices/:type` | OWNER                      |
| GET    | `/api/v1/products/:id/units/:unitId/prices`       | OWNER, STOCK_KEEPER, SALES |
| GET    | `/api/v1/stock`                                   | OWNER, STOCK_KEEPER, SALES |
| GET    | `/api/v1/stock/low-stock`                         | OWNER, STOCK_KEEPER, SALES |
| GET    | `/api/v1/stock/movements`                         | OWNER, STOCK_KEEPER, SALES |
| GET    | `/api/v1/stock/batches/alerts`                    | OWNER, STOCK_KEEPER, SALES |
| POST   | `/api/v1/stock/adjustments`                       | OWNER, STOCK_KEEPER        |
| POST   | `/api/v1/stock/damage`                            | OWNER, STOCK_KEEPER        |
| GET    | `/api/v1/suppliers`                               | OWNER, STOCK_KEEPER        |
| GET    | `/api/v1/suppliers/:id`                           | OWNER, STOCK_KEEPER        |
| POST   | `/api/v1/suppliers`                               | OWNER, STOCK_KEEPER        |
| PATCH  | `/api/v1/suppliers/:id`                           | OWNER, STOCK_KEEPER        |
| POST   | `/api/v1/suppliers/:id/archive`                   | OWNER, STOCK_KEEPER        |
| GET    | `/api/v1/purchases`                               | OWNER, STOCK_KEEPER        |
| GET    | `/api/v1/purchases/:id`                           | OWNER, STOCK_KEEPER        |
| POST   | `/api/v1/purchases`                               | OWNER, STOCK_KEEPER        |
| PATCH  | `/api/v1/purchases/:id`                           | OWNER, STOCK_KEEPER        |
| POST   | `/api/v1/purchases/:id/receive`                   | OWNER, STOCK_KEEPER        |
| POST   | `/api/v1/purchases/:id/cancel`                    | OWNER, STOCK_KEEPER        |
| GET    | `/api/v1/customers`                               | OWNER, SALES               |
| GET    | `/api/v1/customers/:id`                           | OWNER, SALES               |
| GET    | `/api/v1/customers/:id/statement`                 | OWNER, SALES               |
| POST   | `/api/v1/customers`                               | OWNER, SALES               |
| PATCH  | `/api/v1/customers/:id`                           | OWNER, SALES               |
| POST   | `/api/v1/customers/:id/archive`                   | OWNER, SALES               |
| GET    | `/api/v1/invoices`                                | OWNER, SALES               |
| GET    | `/api/v1/invoices/:id`                            | OWNER, SALES               |
| GET    | `/api/v1/invoices/:id/document`                   | OWNER, SALES               |
| POST   | `/api/v1/invoices`                                | OWNER, SALES               |
| POST   | `/api/v1/invoices/:id/void`                       | OWNER                      |
| GET    | `/api/v1/payments`                                | OWNER, SALES               |
| GET    | `/api/v1/payments/:id`                            | OWNER, SALES               |
| POST   | `/api/v1/payments`                                | OWNER, SALES               |
| GET    | `/api/v1/credit/overview`                         | OWNER, SALES               |
| GET    | `/api/v1/credit/overdue`                          | OWNER, SALES               |
| GET    | `/api/v1/credit/ageing`                           | OWNER, SALES               |
| GET    | `/api/v1/reports/sales`                           | OWNER, SALES               |
| GET    | `/api/v1/reports/sales/by-product`                | OWNER                      |
| GET    | `/api/v1/reports/sales/by-category`               | OWNER                      |
| GET    | `/api/v1/reports/sales/by-customer`               | OWNER                      |
| GET    | `/api/v1/reports/sales/by-staff`                  | OWNER                      |
| GET    | `/api/v1/reports/inventory`                       | OWNER, STOCK_KEEPER        |
| GET    | `/api/v1/reports/credit`                          | OWNER                      |
| GET    | `/api/v1/reports/profit`                          | OWNER                      |
| GET    | `/api/v1/reports/purchases`                       | OWNER, STOCK_KEEPER        |
| GET    | `/api/v1/dashboard`                               | OWNER, SALES, STOCK_KEEPER |
| GET    | `/api/v1/platform/dashboard`                      | Platform admin             |
| GET    | `/api/v1/depot/plan`                              | OWNER                      |
| GET    | `/api/v1/audit-log`                               | OWNER                      |
| GET    | `/api/v1/platform/audit-log`                      | Platform admin             |
| GET    | `/api/v1/platform/plans`                          | Platform admin             |
| PATCH  | `/api/v1/platform/depots/:id/plan`                | Platform admin             |
| GET    | `/api/v1/platform/depots`                         | Platform admin             |
| GET    | `/api/v1/platform/depots/:id`                     | Platform admin             |
| POST   | `/api/v1/platform/depots/:id/approve`             | Platform admin             |
| POST   | `/api/v1/platform/depots/:id/reject`              | Platform admin             |
| POST   | `/api/v1/platform/depots/:id/suspend`             | Platform admin             |

Seed the first platform admin with `pnpm --filter api seed:platform-admin`; it reads
`PLATFORM_ADMIN_NAME`, `PLATFORM_ADMIN_EMAIL`, optional `PLATFORM_ADMIN_PHONE`, and
`PLATFORM_ADMIN_PASSWORD` (minimum 12 characters) from the root `.env`. The script uses
`MIGRATION_DATABASE_URL`, never hard-coded credentials.

The global guards authenticate every route unless it is marked `@Public`, and then check the
permission map in `apps/api/src/common/auth/permissions.ts`. A route without an explicit permission
declaration is denied by default. OWNER is a superset of SALES and STOCK_KEEPER. Registration,
approval/rejection/suspension, and successful logins write audit-log rows.

Reference tables `plans` and `roles` are read-only for `smartdepo_app`; roles are seeded by the
migration. Login uses narrow `SECURITY DEFINER` functions in `apps/api/src/prisma/migrations/` to find
one user by email or phone before the depot is known; registration uses a dedicated transaction whose
`app.depot_id` is the newly generated depot id, so it never gets a general cross-depot bypass.

When the password is correct but the depot is PENDING, REJECTED, or SUSPENDED, login and refresh still
return 401 with `details.reason` (`DEPOT_PENDING`, `DEPOT_REJECTED`, or `DEPOT_SUSPENDED`). This lets
the frontend show the right status screen without telling unknown users whether an account exists.

### Staff, passwords, and depot settings

Depot owners manage staff under `/api/v1/users`: list, create, edit, deactivate, and reset a password.
Allowed staff roles are SALES, STOCK_KEEPER, and DELIVERY; OWNER and PLATFORM_ADMIN cannot be created
through this endpoint. Deactivated users cannot log in or refresh. Staff creation and reactivation
respect the active plan's `max_users` limit and return `details.reason:
PLAN_USER_LIMIT_REACHED` when it is reached.

Every authenticated user can change their own password at `/api/v1/auth/change-password` by proving the
current password. An owner password reset sets `must_change_password`, which is returned as
`user.mustChangePassword` in the login response and in `/auth/me`; the client should force a password
change. Rejection and suspension reasons are stored in `depots.status_reason` and copied into the audit
entry.

Depot settings under `/api/v1/depot/settings` cover the name, address, currency, default language
(`locale`), and invoice footer. Every depot role can read them; only the owner can update them. The
depot id always comes from the access token, so there is no settings id to tamper with.

### Catalog: categories, products, units, and prices

Categories and products are depot-scoped. OWNER and STOCK_KEEPER can create, edit, and archive them;
SALES can read categories, products, and the retail/wholesale prices embedded in the product response.
Archived products stay readable for old records but cannot be used for new purchases or invoices.

Every product has exactly one base unit with conversion factor 1. Additional units have a positive
factor different from 1. Quantities are always stored in the base unit; the shared helpers in
`apps/api/src/common/units/quantity.ts` convert decimal input to the base unit and format a base
quantity as readable units such as `12 cartons and 5 bottles`. Fractional kilograms are supported
without floating-point arithmetic.

Prices use `NUMERIC(14,2)` and are written through a decimal string. Only OWNER can change prices.
Every actual price change creates an immutable `price_history` row and a `PRICE_CHANGED` audit entry;
setting the same amount again is a no-op. Product lists support name/SKU search, category and
archived filters, pagination, and sorting, with depot-scoped indexes on the searched columns.
`GET /api/v1/products/:id/units/:unitId/prices` is the read-only history: it returns who changed the
price, when, and the old and new amount for every depot role that can read products.

### Stock, suppliers, and purchases

Stock is never stored as a number. It is the sum of the `stock_movements` ledger in the product base
unit, so every change (purchase, sale, adjustment, return, damage) leaves a signed row with the depot,
product, optional batch, reason, user, and timestamp. `apps/api/src/modules/stock/stock-ledger.service.ts`
is the single entry point for recording movements; it locks the product row inside the caller's
transaction before it reads the current stock, so two concurrent requests cannot both pass the
negative-stock check. SALES reads stock only; OWNER and STOCK_KEEPER manage it.

`GET /api/v1/stock` returns current stock per product in base units and readable units
(`12 cartons and 5 bottles`), including per-batch stock for products that track batches and expiry.
`GET /api/v1/stock/low-stock` lists active products at or below their reorder level, and the product
list carries `currentStock`, `currentStockReadable`, and `lowStock` for the same rule.
`GET /api/v1/stock/movements` is the append-only history with product, type, and date-range filters and
pagination. `GET /api/v1/stock/batches/alerts` returns near-expiry batches (`days` threshold, default 30) and expired batches that still hold stock.

`POST /api/v1/stock/adjustments` takes a signed quantity in any active product unit, converts it to the
base unit, and requires a reason. `POST /api/v1/stock/damage` takes a positive quantity and stores it
as a negative `DAMAGE` movement. Both block a negative result unless the depot allows negative stock,
and both write an audit entry.

Suppliers under `/api/v1/suppliers` keep a name, contact name, phone, email, address, and notes. The
name is unique per depot, and archiving a supplier keeps it on old purchases while blocking it for new
ones.

A purchase starts as a `DRAFT` with a supplier and lines (product, unit, quantity, unit cost, and a
batch number plus expiry date for batch-tracked products). Receiving a draft runs in one transaction:
it claims the draft, creates one `PURCHASE` movement per line, saves the batches, and updates the
product's last cost per base unit. Money uses `NUMERIC(14,2)` and decimal arithmetic, never floats.
Received and cancelled purchases are immutable; corrections are stock adjustments.

The last purchase cost per base unit and the cost on a stock movement are stored with
`NUMERIC(14,4)`: a carton of 24 bottles bought for 10.00 is 0.4167 per bottle, and two decimals
would round that to 0.42 and break the profit numbers. Only the display rounds money to two
decimals. A product that tracks batches also needs a batch on every adjustment and damage entry, so
the batch stock stays correct.

### Customers, invoices, payments, and credit

- Customers keep a name, phone, email, address, a type (retail or wholesale), a credit limit, and
  payment terms in days. Every depot gets one default "Walk-in" customer that cannot be archived.
  The customer type decides which price list an invoice uses. OWNER and SALES manage customers; the
  stock keeper has no access.
- Creating an invoice is one transaction. The server takes the price of the product unit from the
  customer's price list, calculates the totals with decimals, deducts the stock through the stock
  ledger, applies a payment taken at the checkout, and writes the audit entry. Only the OWNER may
  override a price. A discount can be a fixed amount or a percentage, per line and per invoice.
  Invoice numbers are sequential per depot (`INV-000001`) and safe under concurrent requests, and an
  idempotency key makes a retried create return the same invoice.
- Batch-tracked products are sold first expiry first out: the quantity comes from the batches with
  the earliest expiry date, expired batches are never used, and the invoice fails with a clear
  message when the usable batches do not hold enough stock.
- The payment status of an invoice is `PAID`, `PARTIAL`, or `UNPAID` and the due date comes from the
  payment terms of the customer. The customer's credit limit is a depot setting: with `WARN` the
  invoice is created and the response carries a warning, with `BLOCK` the invoice is rejected. The
  balance of a customer is always derived from the invoices and the payments.
- A payment records a method (cash, bank transfer, other) and is allocated to invoices, oldest
  invoice first or with explicit allocations. An allocation may not be bigger than the open amount
  of an invoice or bigger than the payment; money that is not allocated stays as customer credit.
- Voiding an invoice is OWNER only and needs a reason. The stock comes back with `RETURN` movements,
  the unpaid part leaves the customer balance, and money that was already paid is reported as a
  refund due. A voided invoice cannot receive payments and nothing is ever deleted.
- `/api/v1/credit/overview`, `/api/v1/credit/overdue`, and `/api/v1/credit/ageing` show the
  outstanding balance, the overdue invoices, and the ageing buckets (0-30, 31-60, over 60 days).
  `/api/v1/customers/:id/statement` shows the invoices, the payments, and the running balance of one
  customer. `/api/v1/invoices/:id/document` returns everything needed to print an invoice, including
  readable units; the PDF and the thermal receipt come later.

### Reports, dashboard, and platform data

Every report is scoped by the depot of the access token. The queries live in
`apps/api/src/prisma/report-queries.ts` and always filter on the depot id; the tenant session and the
row-level security policies are the second layer. Days are grouped in the time of Phnom Penh
(UTC+7), and voided invoices are never counted.

| Endpoint                     | What it shows                                                                       | Who may read it            |
| ---------------------------- | ----------------------------------------------------------------------------------- | -------------------------- |
| `/reports/sales`             | The days, weeks, or months of a range, plus the totals                              | OWNER, SALES               |
| `/reports/sales/by-product`  | Quantity, revenue, cost of goods sold, and margin per product                       | OWNER                      |
| `/reports/sales/by-category` | The same per category                                                               | OWNER                      |
| `/reports/sales/by-customer` | The same per customer, with the paid and the outstanding amount                     | OWNER                      |
| `/reports/sales/by-staff`    | The same per staff member                                                           | OWNER                      |
| `/reports/inventory`         | Stock, low stock, near-expiry batches, and the value of the stock                   | OWNER, STOCK_KEEPER        |
| `/reports/credit`            | Outstanding balance and ageing (0-30, 31-60, over 60 days) per customer             | OWNER                      |
| `/reports/profit`            | Revenue, cost of goods sold, gross profit, and margin                               | OWNER                      |
| `/reports/purchases`         | Purchases per supplier and month                                                    | OWNER, STOCK_KEEPER        |
| `/dashboard`                 | The KPI cards and the chart data of the depot                                       | OWNER, SALES, STOCK_KEEPER |
| `/platform/dashboard`        | The depots over time, the active depots, the depots per plan, the pending approvals | Platform admin             |

Every report takes `from` and `to` (`YYYY-MM-DD`, in the time of the depot) and `format=csv` to
download the report as a CSV file. `/reports/sales` also takes `unit=day|week|month|custom`, and
`/reports/inventory` takes `expiryDays` (the default is 30 days ahead).

The sales staff only see the totals and the trend of `/reports/sales`; the stock keeper sees the
inventory and the purchase reports. The dashboard returns the part of the data the role may see.

### Sample data generator

`scripts/seed/seed.ts` creates three demo depots (a beer depot, an energy drink depot, and a rice
depot) with owners, staff, categories, products with units and prices, suppliers, customers, and
about three months of purchases, invoices (paid, partly paid, and on credit), payments, stock
adjustments, and near-expiry batches. The business data is written through the real services of the
API, so the invoice numbers, the stock ledger signs, the batch allocation, and the payment
allocations follow the same rules as a live depot. The random seed is fixed, so two runs with the
same seed produce the same data.

```bash
pnpm seed -- --demo                       # three demo depots, three months of data
pnpm seed -- --demo --seed 7 --months 6  # another seed and a longer period
```

The generator refuses to run without `--demo`, only ever touches depots whose name starts with
`Demo `, and reads the login passwords from `DEMO_OWNER_PASSWORD` and `DEMO_STAFF_PASSWORD` in the
root `.env`. It never hard-codes a password, never prints a password, and refuses to run against
`smartdepo_test` unless `--allow-test-database` is given. `pnpm seed` builds the API first, because
the generator runs against the compiled API. The three demo depots get a plan: the beer depot Pro,
the energy depot and the rice depot Basic.

### Plans and the audit log

The platform has three subscription plans. The billing is simulated: the price is only shown in the
interface, and nothing is ever charged.

| Plan       | Users | Products | Price a month |
| ---------- | ----- | -------- | ------------- |
| Free Trial | 5     | 10       | 0.00          |
| Basic      | 15    | 100      | 19.00         |
| Pro        | 50    | 1000     | 49.00         |

Every new depot starts with the Free Trial, and the depots that existed before the plans were
added got it as well. The limits are enforced when a staff account or a product is created: the
answer is a 409 with `details.reason` `PLAN_USER_LIMIT_REACHED` or `PLAN_PRODUCT_LIMIT_REACHED`.
The owner reads the plan of the depot with the usage against the limits under
`GET /api/v1/depot/plan`, and the Platform Admin lists the plans under `GET /api/v1/platform/plans`
and moves a depot to another plan with `PATCH /api/v1/platform/depots/:id/plan`. A plan change closes
the old subscription, starts a new one, and is written to the audit log of the depot.

The audit log is append-only: the database refuses to update or to delete an entry, and there is no
endpoint that could. The owner reads the log of the depot under `GET /api/v1/audit-log` with filters
for the action, the user, the type of record, and the period, plus sorting and paging. The Platform
Admin reads the entries of the platform under `GET /api/v1/platform/audit-log`. The details of an
entry are cleaned before they are shown: a key that looks like a password, a token, or a secret is
removed. The log of one depot is never visible to another depot, and the sales staff, the stock
keeper, and the delivery staff get a 403.

### File storage (Cloudflare R2)

Depot logos and product images are stored in a private Cloudflare R2 bucket and served through
short-lived presigned URLs. The API stores only the object key (`depots.logo_key` and
`products.image_key`), never a public URL.

Setup:

1. Create a bucket in the Cloudflare dashboard and keep it **private**.
2. Create an API token scoped to **Object Read & Write** for that one bucket only (not the whole
   account). Use it for `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`.
3. Set the variables in `.env`:

```bash
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET=your-bucket-name
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
```

4. Add a CORS rule on the bucket so the browser can PUT presigned uploads directly. In the
   Cloudflare dashboard open **R2 > your bucket > Settings > CORS Policy > Edit**, then paste this
   exact rule (add the production web origin if it differs):

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "http://127.0.0.1:3000"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Origins must not have a trailing slash. Logo and product-image uploads use a direct `PUT`, so the
`PUT` method and the `Content-Type` header are required and the browser sends an `OPTIONS` preflight
first.

The storage endpoints are:

| Method | Path                                            | Access              |
| ------ | ----------------------------------------------- | ------------------- |
| POST   | `/api/v1/storage/logo/upload-url`               | OWNER               |
| POST   | `/api/v1/storage/logo/read-url`                 | OWNER               |
| POST   | `/api/v1/storage/logo/confirm`                  | OWNER               |
| POST   | `/api/v1/storage/products/:id/image-upload-url` | OWNER, STOCK_KEEPER |
| POST   | `/api/v1/storage/products/:id/image-read-url`   | OWNER, STOCK_KEEPER |
| POST   | `/api/v1/storage/products/:id/image-confirm`    | OWNER, STOCK_KEEPER |

### Live R2 smoke test

`apps/api/scripts/r2-smoke.mjs` verifies the real bucket with the same `R2StorageProvider` the API
uses, not the in-memory test provider. It creates a tiny PNG under `smoke-test/<random>.png`, checks
a presigned PUT and GET plus the downloaded bytes, confirms the unsigned object URL is not public,
confirms a 2-second presigned URL expires, deletes the object, and checks that it is gone. It prints
only PASS/FAIL and HTTP status codes; signed URLs and credentials are redacted from errors.

Set the five R2 variables in `.env`, then run from the repository root:

```bash
pnpm r2:smoke
```

The same script is available as `pnpm --filter api r2:smoke`.

The bucket must be private, and the token must have **Object Read & Write** for that bucket. The
script uses only the `smoke-test/` prefix and deletes what it uploads. It stops at the first failure,
reports the HTTP status and sanitized R2 error code, and exits non-zero. A 403 `AccessDenied` on
upload/delete usually means the token is read-only or a bucket policy denies writes; a 403 on a
presigned GET usually points at the token/bucket scope. `RequestTimeTooSkewed` means the local clock
needs synchronization.

The unsigned-URL check is not a public-access test. The S3 API endpoint answers an unsigned request
with an error (for example HTTP 400 `InvalidArgument`, 401, 403, or 404); any non-2xx response
without the object bytes is a PASS. The check fails only on a 2xx response or a response body that
contains the uploaded bytes. Public access through an `r2.dev` address or a custom domain is a
separate bucket setting and must stay disabled for this private bucket; the smoke test does not test
those public routes.

### Manual CORS check in a browser

The smoke test runs in Node and cannot test browser CORS, which applies to the presigned PUT sent by
the web app. To check it manually:

1. Start the API and web app (`pnpm --filter api start:dev` and `pnpm --filter web dev`).
2. Sign in as OWNER, open Settings, and choose a small PNG for the depot logo. The upload starts when
   you click **Save settings** (the logo **Upload** button also starts it immediately). For a product,
   edit the product and choose an image; the image upload button starts that upload.
3. In the browser DevTools Network tab, find the `PUT` request to the `r2.cloudflarestorage.com` host.
   A successful browser flow shows an `OPTIONS` preflight with 200/204 followed by the `PUT` with 200.
4. Check the Console for `blocked by CORS policy` errors. In the `PUT` response headers,
   `Access-Control-Allow-Origin` must match the web origin (for example `http://localhost:3000`) or
   be `*` if that is the chosen policy.
5. If the request is blocked, update the bucket CORS rule to allow the web origin, methods `GET` and
   `PUT`, header `Content-Type`, and expose `ETag` (see the rule above). Reload the page before
   retrying because browsers cache preflight results.
6. Confirm the saved image loads through the presigned read URL after the upload.

Presigned URLs expire after 5 minutes. The confirm endpoint reads the first bytes of the uploaded
object to verify it is really JPEG, PNG, or WebP, checks the 2 MB limit, saves the key, deletes the
previous object, and writes an audit entry. Tests use an in-memory storage provider and never call
real R2.

### Frontend authentication and shell

- The access token is kept in memory in the Zustand session store, never in `localStorage`.
- The refresh token is set by Next.js route handlers in an httpOnly, SameSite=Lax cookie scoped to
  `/api/auth`. The browser never receives it in a response body.
- `POST /api/auth/login`, `POST /api/auth/refresh`, and `POST /api/auth/logout` proxy to the API,
  rotate the refresh cookie, and load `/auth/me` after a refresh so a page reload restores the session.
- The API client attaches the access token, retries once after a 401 using the refresh cookie, and
  clears the session with a reason when refresh fails. The shell then redirects to login, pending,
  rejected, or suspended with a clear message.
- The locale is stored in a `smartdepo_locale` cookie and the i18n provider loads `en.json` or
  `km.json`. The UI loads Noto Sans Khmer so Khmer text renders correctly.
- Client route guards are for usability only; every API endpoint still enforces authentication,
  permissions, and depot scope on the server.

### Frontend: stock, suppliers, and purchases

- `/stock` shows the current stock per product in readable units and in base units, with a low-stock
  marker, a search box, and an "All stock / Low stock" filter. Products that track batches get one
  row per batch with the batch number, expiry date, and quantity. Below the table are the adjustment
  and damage form (owner and stock keeper only), the expiry alerts with a day threshold, and the
  movement history with product, type, and date-range filters, pagination, and the user and reason of
  every movement. Sales sees the same page read-only.
- `/suppliers` lists suppliers with search and status filters and creates, edits, and archives them.
  Archiving asks for a confirmation and keeps the supplier on old purchases.
- `/purchases` lists purchases with a status filter. A draft can be created and edited with lines of
  product, unit, quantity, unit cost, and a batch number plus expiry date for batch-tracked products;
  every line shows its line total and the purchase shows the total amount. Receiving and cancelling a
  draft ask for a confirmation first, and received or cancelled purchases are read-only.
- The products screen now shows the current stock and the last purchase cost per base unit, and the
  price history table is read from `GET /api/v1/products/:id/units/:unitId/prices` with the user, the
  date, and the old and new amount.
- All money and quantity arithmetic in the browser uses scaled `BigInt` helpers in
  `apps/web/src/lib/decimal.ts`; the client never does floating-point math on money or quantities.

### Frontend: customers, invoices, payments, and credit

- `/invoices/new` is the sales screen. It picks the customer (the walk-in customer is the default),
  searches the products by name or SKU, shows the price of the unit for the price list of the
  customer, and adds a line with Enter. The arrow keys move through the results, so the screen can be
  used without the mouse. Every line can get a discount (amount or percent) and the invoice can get a
  discount too. The running totals are calculated with decimal strings, and the numbers of the server
  are the ones that are shown after saving. Only the owner can change a price. The screen also shows
  the stock of the product and the batches that are not expired.
- The checkout takes the money that is paid now (amount, method, and reference) or leaves the invoice
  on credit. The messages of the API are translated: not enough stock, not enough usable batches, a
  credit limit warning or block, and the validation errors. Every attempt has an idempotency key
  that is reused when the invoice is sent again, so a double click cannot write two invoices.
- `/invoices` lists the invoices with filters for the customer, the payment status, the date range,
  and the invoice number. The detail shows the lines, the discounts, the totals, the payments, and the
  status. The owner can void an invoice with a reason and a confirmation; a voided invoice shows the
  money that still has to be refunded.
- `/customers` lists the customers with search, create, edit, and archive. The customer page shows
  the outstanding balance, the overdue amount, the statement with the invoices, the payments, and the
  running balance, and it has a "Record payment" dialog with the method, the amount, and the
  allocation: the oldest invoices first by default, or the invoices that the user picks.
- `/credit` shows the outstanding balance of the depot, the overdue invoices, and the ageing buckets
  (0-30, 31-60, over 60 days) with links to the customers.
- The money follows the currency of the depot: KHR has no minor unit, so whole amounts are shown
  without decimals, while USD always shows two. A price per unit keeps its cents because a bottle can
  cost 1.50 KHR.
- Only the owner and the sales staff have these screens; the stock keeper and the delivery staff see
  none of them. Only the owner sees the void button, the price override, and the credit settings.

### Frontend: dashboard, reports, and platform data

- `/dashboard` is the dashboard of the depot. The owner sees nine cards (the sales of today, the
  sales of the month, the number of invoices, the outstanding credit, the overdue amount, the gross
  profit and the margin, the products with low stock, and the batches that expire soon) and the
  charts: the sales over time (daily, weekly, or monthly), the top ten products by revenue and by
  quantity, the sales by category, the top customers by sales and by balance, the credit ageing, the
  sales by day of the week, the purchases against the sales, and the slow-moving stock. Every card
  and every chart links to the report with the same numbers.
- The charts use Recharts. The amounts stay decimal strings in the data of the API; the chart only
  uses a number for the geometry, and the label and the tooltip show the exact amount of the API.
  The colours of the series are dark enough to be read on the light surface, and the charts keep a
  fixed height so they stay readable on a phone.
- `/reports` lists the reports that the role of the session may read, and every report page has a
  period picker (today, the last seven days, this month, or a custom period), a summary, a table
  that sorts in the browser, and a button that downloads the report as a CSV file with the
  `format=csv` option of the API. The sales report has the tabs "by period", "by product", "by
  category", "by customer", and "by staff"; only the owner sees the last four.
- The days are the days of the depot (Asia/Phnom_Penh), the same days the API groups by, so the
  label of a row and the period of the report always agree.
- The reports have no pages, so a report with more than 200 rows shows a warning that the browser
  sorts all of them.
- The sales staff see the sales report and the sales part of the dashboard, the stock keeper the
  inventory and the purchase reports, and the owner every report. The API stays the real guard; the
  frontend only hides what the role may not read.
- `/platform/dashboard` is the dashboard of the platform for the Platform Admin: the depots that
  registered over time, the active depots, the depots per plan, and the depots that wait for an
  approval with a link to the depot review.

### API documentation (Swagger / OpenAPI)

When the API is running, Swagger UI is at:

- `http://localhost:3001/api/docs`
- OpenAPI JSON: `http://localhost:3001/api/docs-json`
- OpenAPI YAML: `http://localhost:3001/api/docs-yaml`

Swagger is enabled outside production by default. Production deployments must opt in with
`SWAGGER_ENABLED=true`; set `SWAGGER_ENABLED=false` to hide it in development. The document covers
the public health, auth, Platform Admin, and catalog endpoints, their DTO validation rules, response
types, the `access-token` bearer scheme, and the blocked-depot `details.reason` values. Use **Authorize** in
the UI with an access token from `POST /api/v1/auth/login` to call protected endpoints.

The Swagger routes are served under Helmet security headers and are not covered by the application
role guards because they are generated documentation, not data endpoints. Keep Swagger disabled in
production unless the API surface is intentionally public.

## Commands

```bash
pnpm install
pnpm --filter api prisma migrate deploy
pnpm --filter api prisma:generate
pnpm --filter api start:dev
pnpm --filter web dev
pnpm lint
pnpm test
pnpm --filter api test:tenant
pnpm --filter api seed:platform-admin
pnpm --filter web test:e2e    # API and web must be running; needs PLATFORM_ADMIN_* in the environment
pnpm seed                            # demo data; needs --demo, see "Sample data generator"
pnpm format
pnpm build
```

The Playwright test registers a fake depot, signs in as the seeded Platform Admin, approves the depot,
and checks it under the Approved tab. From the repository root, load the local environment first:

```bash
set -a && . ./.env && set +a
pnpm --filter web test:e2e
```

Do not run `pnpm build` while `pnpm --filter api start:dev` is running. The build rewrites
`apps/api/dist`, which is also the output folder of the watch mode, so the running API stops with
`Cannot find module '.../apps/api/dist/main'` and stops answering on port 3001. The Next.js proxy then
answers `502 Bad Gateway` and the login screen shows "The server had a problem." Restart the API
dev server after a build. The same applies to `pnpm --filter api prisma:generate`: it rewrites the
generated client and makes the watcher restart the API.

## Phase status

Phase 1 foundation is in place: workspace, tooling, CI, health endpoint, i18n dictionaries, the
initial Prisma schema and migrations, the tenant-aware Prisma access layer, and row-level security.
Phase 2 work in progress includes depot registration, Platform Admin approval/rejection/suspension,
JWT authentication, default-deny permission guards, owner-managed staff accounts, self-service password
change and owner password reset, depot settings, plan user limits, categories, products, units,
decimal conversion helpers, retail/wholesale prices with price history, and audit logging for
registration, review decisions, staff changes, passwords, settings, catalog changes, price changes,
and logins.

API code reaches the database only through `PrismaService.runAsTenant(context, work)`; the
token-derived `TenantContext` is the only source of `depot_id`. Each call opens a transaction and sets
`app.depot_id` with `set_config(..., true)`, so the RLS policies apply to that transaction. Platform
admin work uses the separate `PrismaService.runAsPlatformAdmin(principal, work)` path, which sets
`app.is_platform_admin` instead of using a superuser or `BYPASSRLS` connection. A query made outside
one of these paths has no tenant session and reads no rows: RLS fails closed.

The applied RLS policies live in `apps/api/src/prisma/migrations/20261020075000_row_level_security/`
and `20261020100000_auth_and_depot_rls/`; `apps/api/src/prisma/row-level-security.sql` is the Phase 2
reference copy. The staff/password/settings migration
`20261020120000_staff_passwords_and_settings/` adds `depots.status_reason`,
`users.must_change_password`, and keeps every `auth_*` SECURITY DEFINER function on a pinned
`search_path`. `payments.amount` and `payment_allocations.amount` have positive-amount CHECK
constraints.

Raw SQL (`$queryRaw*`, `$executeRaw*`) is restricted by ESLint to `apps/api/src/prisma/**`, where the
tenant session helper parameterizes the depot id. The generated Prisma client is gitignored and is
rebuilt by the `prebuild`/`pretest` scripts or `pnpm --filter api prisma:generate`.
