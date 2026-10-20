# Task: Frontend foundation and auth screens

## FR IDs

- FR-1: depot registration form and pending-registration screen.
- FR-2: Platform Admin depot list with status, approve, reject, and suspend confirmation dialogs.
- FR-3: role-aware navigation and client route guards, backed by the existing server-side isolation and permission tests.
- FR-6: login screen, access-token handling, refresh, logout, and session restoration.
- FR-50/FR-51 groundwork only: the UI writes no audit entries directly; the existing server-side audit entries for registration and depot review remain in place.

## Summary

Added the Next.js app shell, Khmer/English i18n, session handling, auth forms, status screens, and Platform Admin depot review UI. The Zustand session store keeps the user, role, depot, and access token in memory; the refresh token is stored in an httpOnly SameSite=Lax cookie set by Next.js route handlers under `/api/auth`, and the browser calls the API through a same-origin `/api/v1` rewrite. Login, refresh, logout, pending/rejected/suspended states, role-based navigation, responsive layouts, loading states, empty states, and confirmation dialogs are implemented.

The API gained an additive error detail: when a password is correct but the depot is PENDING, REJECTED, or SUSPENDED, login and refresh still return 401 but include `details.reason` and `details.depotStatus`. Duplicate registration also includes `details.reason: IDENTIFIER_TAKEN`. This lets the frontend show a clear status screen without revealing account existence for a wrong password.

## Files changed

Backend:

- `apps/api/src/modules/auth/auth.service.ts` — status reason details on blocked login/refresh and duplicate registration.
- `apps/api/src/common/filters/http-exception.filter.ts` — forwards structured `details` from exception payloads.
- `apps/api/test/auth.service.spec.ts` — pending-depot reason assertion.
- `apps/api/test/auth.db.tenant-spec.ts` — pending and suspended login reason assertions.

Frontend (new unless noted):

- `apps/web/src/app/layout.tsx` (changed), `globals.css` (rewritten), `page.tsx` (changed).
- `apps/web/src/app/(auth)/layout.tsx`, `login/page.tsx`, `register/page.tsx`, `pending/page.tsx`, `rejected/page.tsx`, `suspended/page.tsx`.
- `apps/web/src/app/(app)/layout.tsx`, `dashboard/page.tsx`, `forbidden/page.tsx`, `platform/depots/page.tsx`.
- `apps/web/src/app/api/auth/login/route.ts`, `refresh/route.ts`, `logout/route.ts`.
- `apps/web/src/components/i18n-provider.tsx`, `session-provider.tsx`, `app-shell.tsx`, `auth-card.tsx`, `brand.tsx`, `confirm-dialog.tsx`, `full-page-loading.tsx`, `language-switch.tsx`, `status-badge.tsx`.
- `apps/web/src/features/auth/login-form.tsx`, `register-form.tsx`, `pending-status.tsx`, `rejected-status.tsx`, `suspended-status.tsx`.
- `apps/web/src/lib/api-client.ts`, `api-error.ts`, `errors.ts`, `format.ts`, `server-auth.ts`, `session-client.ts`, `types.ts`.
- `apps/web/src/stores/session-store.ts`.
- `apps/web/src/i18n/config.ts` (changed), `en.json` (expanded), `km.json` (expanded).
- Tests: `api-client.spec.ts`, `session-store.spec.ts`, `login-form.spec.tsx`, `register-form.spec.tsx`, plus the existing `i18n.spec.ts`.
- `apps/web/jest.config.js` (changed), `jest.setup.ts`, `playwright.config.ts`, `e2e/auth-flow.spec.ts`.
- `apps/web/next.config.ts` (changed), `package.json` (scripts and dependencies).
- `.env.example`, `README.md`, `pnpm-lock.yaml`.

New frontend dependencies and reasons:

- `zustand` for the in-memory session and client state.
- `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, and `jest-environment-jsdom` for component tests.
- `@playwright/test` for the register → admin login → approve flow.

## Tests run

- `pnpm format:check` — passed.
- `pnpm lint` — passed (API and web).
- `pnpm test` — passed: API 8 suites / 38 tests; web 5 suites / 18 tests.
- `pnpm --filter api test:tenant` — passed: test database rebuilt and migrated; 3 suites / 38 tests.
- `pnpm build` — passed: NestJS build and Next.js production build (14 routes).
- `pnpm --filter web test:e2e` — passed: 1 Playwright test, using the local API and web server and the seeded Platform Admin credentials loaded from the local environment.
- `pnpm install --frozen-lockfile` — passed; lockfile is up to date.

Manual checks against the local running API and web app:

- BFF login returned 200, set an HttpOnly refresh cookie, and did not return the refresh token in the response body.
- BFF refresh rotated the refresh cookie and restored the user through `/auth/me`.
- Platform depot list returned 200 with pagination metadata.
- Suspending an approved depot caused the next refresh to return 401 with `details.reason: DEPOT_SUSPENDED`.
- Pending, rejected, and suspended depot owners were routed to the corresponding clear-message screens.
- A non-admin owner opening `/platform/depots` was redirected to `/forbidden`.
- Desktop and phone screenshots were checked; Khmer text rendered with Noto Sans Khmer.

## Security check

- No access or refresh token is written to `localStorage`; the access token is memory-only and the refresh token is an httpOnly, SameSite=Lax cookie scoped to `/api/auth`.
- Auth route handlers strip the refresh token from browser-readable responses.
- The API client attaches the bearer token, retries once after a 401 using the cookie refresh path, and clears the session with a reason when refresh fails.
- Client route guards and role-based navigation are usability only. The API still enforces authentication, permissions, and depot scope on every endpoint.
- The new `details.reason` values are returned only after a correct password (or from refresh with a valid refresh token), so wrong-password requests keep the generic response.
- No new database queries, endpoints, or cross-depot bypasses were added on the frontend. Existing `test:tenant` coverage still passes.
- No credentials, tokens, or secrets are written to source, docs, or reports.

## Open issues / risks

- Refresh tokens remain stateless with no server-side revocation store. A suspended depot's already-issued access token can remain valid until its 15-minute expiry; refresh and new logins are blocked, and the frontend ends the session on the next refresh.
- Rate limiting is still the local in-memory limiter from task 004, so it is per process and skipped under `NODE_ENV=test`.
- Noto Sans Khmer and Inter are loaded from Google Fonts at runtime. An offline or restricted deployment should self-host those font files.
- The Playwright test requires the local API, a local PostgreSQL database, the web server, and `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` in the environment. It is not run in CI because CI has no PostgreSQL service.
- Rejected/suspended screens give a clear status and next step but do not display the stored rejection reason. The reason remains visible to the Platform Admin workflow and audit log.
- Page-level protection is client-side for usability; direct data access is still governed by the API. No server-side page redirect middleware was added.
- The refresh cookie has a fixed seven-day lifetime; if `JWT_REFRESH_TTL` is changed to something shorter, the backend rejects the cookie and the BFF clears it.

## Decisions needed from the human

- Confirm the in-memory access token + httpOnly refresh cookie + Next.js BFF approach.
- Confirm that the additive `details.reason` contract on 401 responses is acceptable for task 004's API.
- Confirm whether Noto Sans Khmer should be self-hosted before the final demo.
- Confirm whether rejected/suspended screens should display the stored rejection reason to depot users.

## Status

ready for review

## Human review (filled in by the human only)
Decision: pending
Notes:
