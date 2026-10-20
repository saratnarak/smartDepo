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

| Method | Path                                  | Access                 |
| ------ | ------------------------------------- | ---------------------- |
| POST   | `/api/v1/auth/register`               | Public, rate limited   |
| POST   | `/api/v1/auth/login`                  | Public, rate limited   |
| POST   | `/api/v1/auth/refresh`                | Public, rate limited   |
| GET    | `/api/v1/auth/me`                     | Any authenticated role |
| GET    | `/api/v1/platform/depots`             | Platform admin         |
| GET    | `/api/v1/platform/depots/:id`         | Platform admin         |
| POST   | `/api/v1/platform/depots/:id/approve` | Platform admin         |
| POST   | `/api/v1/platform/depots/:id/reject`  | Platform admin         |
| POST   | `/api/v1/platform/depots/:id/suspend` | Platform admin         |

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

### API documentation (Swagger / OpenAPI)

When the API is running, Swagger UI is at:

- `http://localhost:3001/api/docs`
- OpenAPI JSON: `http://localhost:3001/api/docs-json`
- OpenAPI YAML: `http://localhost:3001/api/docs-yaml`

Swagger is enabled outside production by default. Production deployments must opt in with
`SWAGGER_ENABLED=true`; set `SWAGGER_ENABLED=false` to hide it in development. The document covers
the public health, auth, and Platform Admin endpoints, their DTO validation rules, response types,
the `access-token` bearer scheme, and the blocked-depot `details.reason` values. Use **Authorize** in
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
pnpm seed
pnpm format
pnpm build
```

The Playwright test registers a fake depot, signs in as the seeded Platform Admin, approves the depot,
and checks it under the Approved tab. From the repository root, load the local environment first:

```bash
set -a && . ./.env && set +a
pnpm --filter web test:e2e
```

## Phase status

Phase 1 foundation is in place: workspace, tooling, CI, health endpoint, i18n dictionaries, the
initial Prisma schema and migrations, the tenant-aware Prisma access layer, and row-level security.
Phase 2 work in progress includes depot registration, Platform Admin approval/rejection/suspension,
JWT authentication, default-deny permission guards, and audit logging for registration, review
decisions, and logins.

API code reaches the database only through `PrismaService.runAsTenant(context, work)`; the
token-derived `TenantContext` is the only source of `depot_id`. Each call opens a transaction and sets
`app.depot_id` with `set_config(..., true)`, so the RLS policies apply to that transaction. Platform
admin work uses the separate `PrismaService.runAsPlatformAdmin(principal, work)` path, which sets
`app.is_platform_admin` instead of using a superuser or `BYPASSRLS` connection. A query made outside
one of these paths has no tenant session and reads no rows: RLS fails closed.

The applied RLS policies live in `apps/api/src/prisma/migrations/20261020075000_row_level_security/`
and `20261020100000_auth_and_depot_rls/`; `apps/api/src/prisma/row-level-security.sql` is the Phase 2
reference copy. `payments.amount` and `payment_allocations.amount` have positive-amount CHECK
constraints.

Raw SQL (`$queryRaw*`, `$executeRaw*`) is restricted by ESLint to `apps/api/src/prisma/**`, where the
tenant session helper parameterizes the depot id. The generated Prisma client is gitignored and is
rebuilt by the `prebuild`/`pretest` scripts or `pnpm --filter api prisma:generate`.
