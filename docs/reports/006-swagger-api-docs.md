# Task: Swagger / OpenAPI documentation for the backend

## FR IDs

No PRD feature ID is added by this task. It documents the existing FR-1 (depot registration), FR-2 (Platform Admin depot review), FR-3 (access control), and FR-6 (authentication) endpoints so future backend work can be explored and tested from Swagger UI.

## Summary

Added Swagger UI and an OpenAPI 3 document to the NestJS API. The UI is served at `/api/docs`, with JSON at `/api/docs-json` and YAML at `/api/docs-yaml`. The document covers health, auth, and Platform Admin endpoints, request DTO validation, success and error responses, the `access-token` bearer scheme, and the blocked-depot `details.reason` values.

Swagger is enabled outside production by default and disabled in production unless `SWAGGER_ENABLED=true`. Helmet now runs before the Swagger routes are registered, so the documentation also receives the security headers that the rest of the API already had. The UI was opened in Chromium with no console errors and with all 10 operations visible.

## Files changed

- `apps/api/package.json` — added `@nestjs/swagger@12.0.2`.
- `pnpm-lock.yaml` — dependency resolution.
- `pnpm-workspace.yaml` — explicitly denied `@scarf/scarf` install scripts (telemetry package pulled transitively by Swagger UI) instead of running an unreviewed build script.
- `apps/api/src/common/bootstrap/configure-swagger.ts` — new Swagger document, bearer scheme, tags, environment switch, and UI configuration.
- `apps/api/src/common/bootstrap/configure-app.ts` — registers Swagger with the shared app configuration used by tests and the running server.
- `apps/api/src/main.ts` — moved Helmet before `configureApp` so the docs routes are covered by security headers.
- `apps/api/src/modules/auth/auth.controller.ts` — auth tags, operations, request/response schemas, and documented blocker reasons.
- `apps/api/src/modules/auth/dto/login.dto.ts`, `refresh-token.dto.ts`, `register-depot.dto.ts` — Swagger property metadata.
- `apps/api/src/modules/auth/dto/auth-response.dto.ts` — new response schemas for registration, login, refresh, and `/auth/me`.
- `apps/api/src/modules/platform-admin/platform-admin.controller.ts` — Platform Admin tags, operations, bearer auth, parameters, and error responses.
- `apps/api/src/modules/platform-admin/dto/depot-reason.dto.ts`, `list-depots-query.dto.ts` — Swagger property/query metadata.
- `apps/api/src/modules/platform-admin/dto/depot-admin-view.dto.ts` — new depot view and paginated response schemas.
- `apps/api/src/modules/health/health.controller.ts` and `apps/api/src/modules/health/dto/health-status.dto.ts` — documented health response.
- `apps/api/test/configure-swagger.spec.ts` — environment-switch unit tests.
- `apps/api/test/auth.db.tenant-spec.ts` — verifies the OpenAPI JSON, its paths, and the bearer security scheme.
- `.env.example` — documents optional `SWAGGER_ENABLED`.
- `README.md` — documents the docs URLs, production behavior, bearer usage, and security note.

## Tests run

- `pnpm format:check` — passed.
- `pnpm lint` — passed (API and web).
- `pnpm test` — passed: API 9 suites / 41 tests; web 5 suites / 18 tests.
- `pnpm --filter api test:tenant` — passed: test database rebuilt and migrated; 3 suites / 39 tests.
- `pnpm build` — passed: NestJS and Next.js production builds.
- `pnpm --filter web test:e2e` — passed: 1 Playwright auth/depot-review flow; no regression from the backend documentation changes.
- `pnpm install --frozen-lockfile` — passed; lockfile is up to date.

Manual checks against the running API:

- `GET /api/docs` returned 200 and rendered Swagger UI with 10 operations and one Authorize button.
- `GET /api/docs-json` and `GET /api/docs-yaml` returned 200.
- The JSON lists paths under `/api/v1`, the `access-token` bearer scheme, `LoginDto` request bodies, and the `LoginResponseDto` response schema.
- The docs response now includes Helmet `Content-Security-Policy`, `X-Frame-Options`, and related headers.
- Swagger UI loaded in Chromium without console or page errors.

## Security check

- Swagger is disabled in production by default; enabling it is an explicit `SWAGGER_ENABLED=true` decision.
- The docs routes are generated documentation and are not protected by role guards. They expose the API surface, not depot data; all documented data endpoints still enforce authentication, permissions, tenant scope, and row-level security.
- Helmet security headers now apply to `/api/docs` as well as the API controllers.
- No secrets, credentials, or real tokens are placed in the OpenAPI description or examples.
- The default-deny role guard and cross-tenant tests are unchanged and still pass.
- `@scarf/scarf`'s install script is explicitly denied rather than approved; it is telemetry, not functionality needed by Swagger.

## Open issues / risks

- If Swagger is enabled in production, the API surface is public. Put it behind a private network, gateway authentication, or keep `SWAGGER_ENABLED=false`.
- `SWAGGER_ENABLED` is read at process startup, so changing it requires an API restart.
- The documentation is maintained through decorators; new controllers and DTOs must add Swagger metadata or they will appear incomplete.
- Swagger UI comes from `@nestjs/swagger@12.0.2` and `swagger-ui-dist`; dependency updates should be reviewed like any other frontend asset.
- The docs tests verify paths, schemas, and the security scheme, not every example value or browser interaction with Try it out.

## Decisions needed from the human

- Confirm `/api/docs` as the documentation path.
- Confirm that docs stay public in development and disabled by default in production.
- Confirm whether the production demo should set `SWAGGER_ENABLED=true` or keep the docs disabled.

## Status

ready for review

## Human review (filled in by the human only)
Decision: approved

