# AGENTS.md: SmartDepo

Instructions for AI coding agents (coder, reviewer, tester) working on this repository. Read this file fully before doing any task. If something here conflicts with a task description, stop and ask.

## 1. Project summary

SmartDepo is a multi-tenant web platform for depots (wholesale distributors) that sell goods such as beer, energy drinks, and rice in bulk to retailers and restaurants. A depot owner registers, the Platform Admin approves the depot, and the depot gets a private workspace for products and units, stock, customers and credit, invoices, suppliers and purchases, and reports.

This is a university semester project (Norton University, Year 4, Semester 1, 2026-2027). It covers four courses: Advanced Web Development, Software Security Technology, Software Engineering, and Business Intelligence. Final submission and demo: end of December 2026. There is no real depot; the project uses generated sample data.

**Source of truth:** `docs/PRD.md`. Requirement IDs (FR-1 ... FR-51) in this file refer to that PRD. If the PRD and this file disagree, the PRD wins for features and this file wins for engineering rules.

## 2. Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + React + TypeScript, Zustand for client state, i18n for Khmer and English, Recharts for charts |
| Backend | NestJS + TypeScript, REST API |
| Database | PostgreSQL, accessed through Prisma (or TypeORM if the team switches; do not mix both) |
| Auth | JWT (short-lived access token + refresh token), role and depot claims |
| Testing | Jest (unit + API), Supertest for API, Playwright optional for key UI flows |
| Infra | Local PostgreSQL managed with pgAdmin for development; Docker is optional (only if needed for the final demo deployment) |

Use the latest stable versions at project start and pin them. Do not add a new dependency without stating why in the task report.

## 3. Repository structure

```
smartdepo/
  AGENTS.md
  docs/
    PRD.md
    SRS.md                 (written during phase 1)
    security-test-report.md
    reports/               one task report per finished task (001-..., 002-...)
  apps/
    api/                   NestJS backend
      src/
        modules/           one folder per module (see section 5)
        common/            guards, decorators, filters, tenant scope, utils
        prisma/            schema.prisma, migrations, seed
      test/                API and cross-tenant tests
    web/                   Next.js frontend
      src/
        app/               routes
        components/
        features/          feature folders (products, invoices, customers, reports)
        stores/            Zustand stores
        i18n/              km.json, en.json
        lib/               API client, helpers
  scripts/
    seed/                  sample data generator
  docker-compose.yml       (optional; the developer uses a local PostgreSQL)
  .env.example
```

If the structure does not exist yet, create it as above. Do not invent a different layout.

## 4. Commands

Package manager: pnpm (workspace). If a command below does not exist yet, create it as part of the task.

```
pnpm install
                                # PostgreSQL runs locally (managed in pgAdmin); make sure it is running
pnpm --filter api prisma migrate dev
pnpm --filter api start:dev
pnpm --filter web dev
pnpm lint
pnpm test                       # unit + API tests
pnpm --filter api test:tenant   # cross-tenant isolation tests
pnpm seed                       # generate sample depots and data
```

Always run `pnpm lint` and `pnpm test` before reporting a task as ready.

### Database (local PostgreSQL)

The developer runs PostgreSQL locally and manages it with pgAdmin. Docker is not required.

- **Two databases:** `smartdepo` (development) and `smartdepo_test` (tests). Tests must only run against `smartdepo_test`; the test setup must refuse to run if the database name does not end with `_test`.
- **Two roles:** `smartdepo_owner` (runs migrations and owns the tables) and `smartdepo_app` (used by the running API and by tests; not a superuser, no BYPASSRLS), so row-level security actually applies.
- **Environment variables** in `.env` (never committed): `DATABASE_URL` (app role, development), `MIGRATION_DATABASE_URL` (owner role), `TEST_DATABASE_URL` (app role, test database). `.env.example` contains placeholders only.
- Never drop, reset, or truncate the development database without asking. Use `prisma migrate dev` for development; use `prisma migrate reset` only on the test database.
- Do not put real credentials in code, scripts, reports, or docs.
- If the database is not reachable, say so in the report. Do not claim database tests passed if they were not run.

## 5. Backend modules

`auth`, `platform-admin`, `depots` (tenants), `plans`, `users`, `categories`, `products`, `units`, `stock`, `customers`, `sales`, `payments`, `suppliers`, `purchases`, `reports`, `audit-log`.

Each module has: controller, service, DTOs (with `class-validator`), repository or Prisma access, and tests. Controllers contain no business logic.

## 6. Domain rules (must follow)

### 6.1 Multi-tenancy
- One shared database and schema. Every depot-owned table has a non-null `depot_id`.
- The depot comes from the authenticated user's token, never from the request body, query, or URL.
- Every query on a depot table goes through the tenant scope in `common/` (a tenant-aware Prisma client or repository base). Never write a raw query on a depot table without `depot_id`.
- PostgreSQL row-level security is a second layer. Do not rely on it alone.
- Platform Admin endpoints live under `/api/v1/platform/*` and are the only endpoints that cross depots.

### 6.2 Units and quantities
- Every product has a base unit (for example bottle, kg). Other units (carton, crate, sack) have a conversion factor to the base unit.
- Store and calculate all quantities in the base unit. Convert only for input and display (for example "12 cartons and 5 bottles").
- Never use floating point for quantities that can be fractional (kg). Use PostgreSQL `NUMERIC` and a decimal library in code.

### 6.3 Stock
- Never edit a stock quantity directly. Stock is the sum of `stock_movements` (types: purchase, sale, adjustment, return, damage).
- Every movement records depot, product, batch (if any), quantity in base unit (signed), user, reason, and timestamp.
- Stock cannot go negative unless the depot setting allows it.

### 6.4 Money, invoices, and credit
- Never use floating point for money. Use `NUMERIC(14,2)` in the database and a decimal type in code. Store the currency on the depot.
- Completing an invoice must, in one database transaction: create the invoice and lines, create sale stock movements, update the customer balance, and write the audit log entry.
- An invoice can be fully paid, partly paid, or on credit. Payments are separate records applied to invoices. The customer balance is derived from invoices and payments, not typed in by hand.
- Voids and returns reverse stock and balance and require a reason and a permitted role.

### 6.5 Audit log
- Log price changes, stock adjustments, voids, payments, user and role changes, and logins, per depot.
- Audit logs are append-only. No update or delete endpoints.

## 7. Security rules (non-negotiable)

- Passwords: bcrypt or Argon2. Never log passwords, tokens, or secrets.
- Enforce role-based access on the server for every endpoint with guards. Hiding a button in the UI is not security.
- Roles: `PLATFORM_ADMIN`, `OWNER`, `SALES`, `STOCK_KEEPER`, `DELIVERY`. Default deny: an endpoint without an explicit role guard is a bug.
- Validate and whitelist all input with DTOs (`whitelist: true`, `forbidNonWhitelisted: true`).
- Use the ORM or parameterized queries only. No string-built SQL.
- Prevent insecure direct object references: always look up records by id AND depot_id.
- Rate limit login and registration endpoints. Lock or slow down after repeated failures.
- Security headers, CORS limited to the frontend origin, HTTPS in deployment.
- Secrets only in environment variables. Never commit `.env`. Keep `.env.example` up to date with placeholder values.
- Every new endpoint needs at least one test proving another depot's user gets 403 or 404.

## 8. Khmer and English (i18n)

- All user-facing text goes through the i18n files (`km.json`, `en.json`). No hard-coded UI strings.
- Khmer text must render correctly in the UI, invoices, receipts, and PDF exports. Use a Khmer-supporting font (for example Noto Sans Khmer) and embed it in PDFs.
- Format dates, numbers, and currency through shared helpers, not inline.

## 9. Coding conventions

- TypeScript strict mode on, no `any` without a comment explaining why.
- API prefix `/api/v1`. REST naming, plural nouns. Consistent error format: `{ statusCode, error, message, details? }`.
- List endpoints support pagination, sorting, and filtering. Return `{ data, meta: { page, pageSize, total } }`.
- Keep functions small. Business logic in services. No logic in controllers or React components that belongs in a service or hook.
- Frontend: server state through the API client (React Query or similar is allowed); Zustand only for client state (session, invoice cart, filters).
- Responsive layout. Forms show clear validation errors and confirm destructive actions.
- Names: files in kebab-case, classes in PascalCase, variables and functions in camelCase, database tables in snake_case plural.
- Commit-ready code only: no commented-out blocks, no leftover console.log, no unused imports.

## 10. Testing requirements

- Unit tests for services (especially unit conversion, stock calculation, invoice totals, credit balance).
- API tests for every endpoint: success, validation failure, unauthorized, forbidden role, and wrong depot.
- Cross-tenant tests are mandatory for every module (`test:tenant`). A depot A user must never read, change, or delete depot B data by any endpoint or id.
- Report queries are tested against the seed data with known expected totals.
- Tests must be deterministic and runnable on a clean database.

## 11. How agents work on this repository

### Roles
- **Coder:** implements one task at a time, following this file and the PRD. Keeps changes small and focused.
- **Reviewer:** checks the diff against sections 6 to 10, looks for tenant leaks, missing guards, float money, direct stock edits, and missing tests. Reports findings; does not rewrite the feature.
- **Tester:** runs lint, unit, API, and cross-tenant tests, then tries the feature path manually or with Playwright. Reports pass or fail with evidence.

Typical flow: orchestrator (plans and splits the task) -> coder -> reviewer -> tester -> ready for human review.

### Rules for every agent
1. Read `docs/PRD.md` and the relevant section of this file before starting. Name the FR IDs the task covers.
2. Explore the existing code first. Reuse existing helpers, guards, and patterns instead of creating new ones.
3. Work on one task at a time. Do not expand scope. If you find a related problem, report it instead of fixing it silently.
4. **Do not run `git commit` or `git push`.** Leave changes uncommitted. The human reviews the changed files and commits.
5. **Do not mark any task as Done.** Finish with "ready for review". Only the human sets the final status.
6. Do not delete or rewrite migrations that were already applied. Add a new migration.
7. Do not change the tech stack, folder structure, or this file without asking.
8. Do not invent requirements. If a requirement is unclear or listed as an open question (section 14), stop and ask.
9. Do not put real secrets or real personal data anywhere. Sample data must be fake.
10. When a task is finished, save the task report as a Markdown file in `docs/reports/` (see "Saving task reports" below). A task is not ready for review until its report file exists.
11. Before starting a task, read the latest reports in `docs/reports/` so you know what was done, what was deferred, and which decisions are still open.

### Definition of ready for review
- Code follows sections 6 to 9
- `pnpm lint` and `pnpm test` pass, and `test:tenant` passes if the task touches depot data
- New endpoints have role guards and wrong-depot tests
- New UI text exists in both `km.json` and `en.json`
- `.env.example` and docs updated if configuration or behavior changed
- The final report lists: FR IDs covered, files changed, commands run with results, and anything left undone or uncertain
- The report is saved as a Markdown file in `docs/reports/`

### Task report format

```
Task: <name>
FR IDs: <list>
Summary: <what was done, 2-4 lines>
Files changed: <list>
Tests run: <commands and results>
Security check: <guards added, cross-tenant test added>
Open issues / risks: <list or "none">
Decisions needed from the human: <list or "none">
Status: ready for review
```

### Saving task reports

- Save every finished task's report as `docs/reports/NNN-short-task-name.md`, where NNN is the next number (001, 002, 003, ...) and the name is lowercase kebab-case, for example `003-depot-registration.md`.
- Use the task report format above, written as Markdown with one heading per field, and end the file with this block:

```
## Human review (filled in by the human only)
Decision: pending
Notes:
```

- Agents never change the Decision line. Only the human sets it to `approved` or `changes requested`.
- If a task needs rework after review, do not overwrite the old report. Save a new one (for example `004-depot-registration-fixes.md`) that links to the earlier report.
- Reports must be accurate: list only commands that were actually run, and say clearly when something could not be run or verified.
- Do not put secrets, tokens, or real personal data in reports.

## 12. Roadmap and task backlog

Priority: P0 = must have, P1 = should have, P2 = nice to have. Build all P0 before P1, and P1 before P2. The target is all P0 finished by the start of December.

### Phase 1: Foundation (weeks 1-2)
- [ ] Monorepo setup, Docker Compose with PostgreSQL, lint, format, Jest, CI
- [ ] `docs/SRS.md`: use cases, user stories, UML (use case, ER, architecture)
- [ ] Prisma schema for all core tables with `depot_id`, indexes, and base migrations
- [ ] Tenant scope helper and row-level security setup

### Phase 2: Platform core (week 3) - FR-1 to FR-10
- [ ] Depot registration and Platform Admin approval, reject, suspend (FR-1, FR-2)
- [ ] Authentication, JWT with depot and role claims, refresh tokens (FR-6)
- [ ] Role guards and tenant isolation tests (FR-3)
- [ ] Staff management by Owner (FR-7)
- [ ] Rate limiting and lockout, password change and reset (FR-8, FR-9)
- [ ] Depot settings and simulated plans (FR-10, FR-4)

### Phase 3: Depot core (weeks 4-6) - FR-11 to FR-39
- [ ] Categories, products, units and conversion, prices (FR-11 to FR-13, FR-16)
- [ ] Stock movements, adjustments, low-stock alerts (FR-17 to FR-20)
- [ ] Suppliers and purchases with receiving (FR-36 to FR-38)
- [ ] Customers, invoices, payments, credit balance (FR-23, FR-25, FR-26, FR-29, FR-30)
- [ ] Invoice output: on-screen, print, PDF, thermal receipt layout (FR-33)
- [ ] P1 items: special prices, batch and expiry, expiry alerts, credit limit, ageing, statements, discounts, voids, payment method, supplier payables (FR-14, FR-15, FR-21, FR-24, FR-27, FR-28, FR-31, FR-32, FR-34, FR-35, FR-39)

### Phase 4: BI layer (week 7) - FR-42 to FR-49
- [ ] Sample data generator for two or three demo depots (beer and drinks, rice), with several months of sales, payments, and purchases
- [ ] SQL views or aggregate queries for reports, scoped by depot
- [ ] Sales, inventory, credit, and profit reports (FR-42 to FR-46)
- [ ] Depot dashboard with KPI cards and Recharts charts (FR-49)
- [ ] P1: purchase report, PDF and CSV export (FR-47, FR-48)

### Phase 5: Security and polish (weeks 8-9)
- [ ] Platform Admin dashboard (FR-5)
- [ ] Audit log and viewer (FR-50, FR-51)
- [ ] Khmer and English complete, Khmer fonts in PDF and receipts
- [ ] OWASP Top 10 testing and fixes; write `docs/security-test-report.md`
- [ ] Performance check against targets in the PRD
- [ ] Usability test with a few users (SUS survey)

### Phase 6: Delivery (week 10)
- [ ] Deployment, demo data, demo video, final documentation and slides
- [ ] P2 only if time allows: delivery notes and status (FR-40), returnable bottles and crates with deposits (FR-41), earliest-expiry-first suggestion (FR-22)

## 13. Out of scope (do not build)

- Online store or ordering app for retailers
- Real payment gateway or real subscription billing (plans are simulated)
- Multiple branches or warehouses inside one depot
- Native mobile apps
- Accounting, tax filing, full bookkeeping
- Route optimization and live GPS tracking
- Barcode scanner hardware integration

## 14. Open questions (do not guess; ask the human)

- Exact submission and demo date in December
- Which deliverables each of the four lecturers requires
- Thermal printer model or paper width for receipt testing
- Whether a new depot activates immediately as a free trial or only after Platform Admin approval (the PRD assumes approval)
- Whether delivery tracking and returnable deposits are in scope or future work