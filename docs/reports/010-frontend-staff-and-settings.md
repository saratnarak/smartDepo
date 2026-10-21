# Task: Frontend staff management, passwords, and depot settings

## FR IDs

- FR-7: Owner creates, edits, deactivates, and reactivates staff and assigns roles.
- FR-8: Users change their own password; Owner resets staff passwords; a reset forces a password change at next sign-in.
- FR-10: Owner manages depot name, address, currency, default language, and invoice footer; other depot roles read the same values.
- FR-4: Staff creation and reactivation show the active plan's user-limit error clearly.
- FR-5 (partial): Depot review table shows the recorded status reason.
- FR-6: Login and session handling now carry `mustChangePassword`.

## Summary

Added the staff management, change-password, forced password-change, and depot settings
frontend on top of the existing API. Navigation is now role-based, the owner-only staff page
supports create, edit, deactivate, reactivate, reset password, and the plan user-limit message,
and staff users see depot settings read-only. Platform Admin depot review now displays each
depot's status reason. All new user-facing text exists in English and Khmer.

## Files changed

New files:

- `apps/web/src/lib/navigation.ts`
- `apps/web/src/lib/navigation.spec.ts`
- `apps/web/src/components/password-field.tsx`
- `apps/web/src/components/modal.tsx`
- `apps/web/src/components/app-shell.spec.tsx`
- `apps/web/src/features/auth/change-password-form.tsx`
- `apps/web/src/features/auth/change-password-form.spec.tsx`
- `apps/web/src/features/staff/staff-errors.ts`
- `apps/web/src/features/staff/staff-form.tsx`
- `apps/web/src/features/staff/staff-form.spec.tsx`
- `apps/web/src/features/staff/reset-password-dialog.tsx`
- `apps/web/src/features/depot-settings/depot-settings-form.tsx`
- `apps/web/src/features/depot-settings/depot-settings-form.spec.tsx`
- `apps/web/src/app/(app)/staff/page.tsx`
- `apps/web/src/app/(app)/settings/page.tsx`
- `apps/web/src/app/(app)/change-password/page.tsx`

Modified files:

- `apps/web/src/lib/types.ts`: `mustChangePassword`, staff, and depot-settings types.
- `apps/web/src/lib/api-client.ts`: staff, password, and depot-settings calls.
- `apps/web/src/lib/errors.ts`: plan user-limit message mapping.
- `apps/web/src/stores/session-store.ts`: `updateUser` and `updateDepot` actions.
- `apps/web/src/stores/session-store.spec.ts`: coverage for the new actions.
- `apps/web/src/components/app-shell.tsx`: role-filtered navigation, route guard, and forced password-change shell.
- `apps/web/src/features/auth/login-form.tsx`: login redirect honors `mustChangePassword`.
- `apps/web/src/features/auth/register-form.tsx`: same redirect rule for an authenticated registration.
- `apps/web/src/features/auth/login-form.spec.tsx`: forced-change redirect test and updated fixture.
- `apps/web/src/app/page.tsx`: home redirect honors `mustChangePassword`.
- `apps/web/src/app/(app)/platform/depots/page.tsx`: status-reason column.
- `apps/web/src/i18n/en.json`, `apps/web/src/i18n/km.json`: all new strings, matching keys.
- `apps/web/src/app/globals.css`: password toggle, forms, read-only settings, staff/platform table, forced shell, responsive rules.
- `apps/web/src/lib/api-client.spec.ts`: fixture updated for the required session field.
- `docs/reports/010-frontend-staff-and-settings.md`: this report.

No API, database, migration, or `.env` changes were made in this task.

## Tests run

- `pnpm format:check` — passed: all files use Prettier style.
- `pnpm lint` — passed for both `apps/api` and `apps/web`.
- `pnpm test` — passed:
  - API: 11 suites, 65 tests.
  - Web: 10 suites, 38 tests.
- `pnpm --filter api test:tenant` — passed: 4 suites, 60 tests after preparing `smartdepo_test`.
- `pnpm build` — passed for API and web; the web build generated `/staff`, `/settings`, and `/change-password`.
- Manual browser check with headless Chrome through CDP, using fake local dev data:
  - Owner created a SALES staff account and saw the success message.
  - Owner reset the staff password and saw the forced-change notice.
  - Staff signed in with the temporary password, was redirected to `/change-password`, could not see the normal navigation, and completed the change.
  - After the change, the SALES navigation contained Dashboard, Settings, and Change password, but not Staff.
  - Settings rendered read-only for the SALES user and editable for the Owner.
  - Staff and settings pages rendered in Khmer and at a 390 px phone viewport.
  - Platform Admin saw a missing-reason validation error, rejected a fake test depot with a reason, and the reason appeared in the new status-reason column.
  - Sidebar order was corrected so Platform Admin sees Depot review before Change password.

## Security check

- The server remains the enforcement point. The client route guard only prevents empty screens; the existing server guards and tenant scope were not weakened.
- `/staff` is Owner-only in navigation, client route guard, and the existing API permission guard.
- Depot settings are editable only for `OWNER`; other depot roles get a read-only view.
- No new endpoint was added and no query bypasses the tenant scope.
- Staff and settings actions use the existing authenticated API client and token.
- Password inputs use `type="password"` with an explicit show/hide toggle.
- No secrets, tokens, passwords, or real personal data were added to code, tests, or this report.
- The forced-change flow is covered by a component test and was exercised manually through reset, logout, and re-login.

## Open issues / risks

- The API does not yet reject other endpoints while `mustChangePassword` is true. A user who bypasses the UI could call the API with the temporary session. The frontend block is complete, but a server guard would make the rule strict. This was left out because the task was scoped to the frontend.
- FR-10 logo editing is not implemented. The settings form covers the fields listed for this task: name, address, currency, default language, and invoice footer.
- On phone widths the staff and platform tables use horizontal scrolling, consistent with the existing table pattern. Actions remain reachable by scrolling, but they are not visible in the first viewport.
- The platform review page still offers Approve for a rejected depot; this pre-existing behavior was not changed.
- Manual QA created fake local test records (one staff account and one rejected test depot). They contain no real data and can be removed from the development database if desired.

## Decisions needed from the human

- Decide whether to add a server-side `mustChangePassword` guard so the rule cannot be bypassed through the API.
- Decide whether depot logo upload belongs in a later FR-10 task.

## Status

ready for review

## Human review (filled in by the human only)
Decision: approved
Notes:
