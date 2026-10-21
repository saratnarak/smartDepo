# Task: Auth form control consistency

## FR IDs

- FR-1: registration form layout.
- FR-6: login form layout.
- No behavior or API change.

## Summary

Fixed the two visual inconsistencies visible on the registration screen. `.field` no longer stretches
its auto-sized grid rows when a neighbouring field has extra content (the password hint), so the
"Password" and "Confirm password" labels and inputs now align on the same baseline and height.
Text inputs now use the shared 5px `--radius-sm` token instead of the 10px card radius, matching the
buttons, alerts, badges, and navigation controls. The same rules apply to every form in the app.

## Files changed

- `apps/web/src/app/globals.css`: `align-content: start` on `.field`; input/textarea/select radius set
  to `--radius-sm`.
- `docs/reports/007-auth-form-consistency.md` (this report).

## Tests run

- `pnpm format:check` — passed.
- `pnpm lint` — passed (API and web).
- `pnpm --filter web test` — passed: 5 suites / 18 tests.
- Visual check with Playwright screenshots against the running dev server:
  - `/register` at 1100×950: password/confirm labels and inputs aligned; the hint no longer pushes
    the second column down.
  - `/login` at 1100×850: inputs, button, and card radii consistent.
- `pnpm build` was not rerun because the Next dev server was running; Next compiled `/register` and
  `/login` successfully when the screenshots were taken. The change is CSS-only.

## Security check

- CSS-only change. No endpoint, guard, query, tenant scope, or auth behavior was touched.
- No new user-facing strings, so `km.json` and `en.json` are unchanged.

## Open issues / risks

- The password hint still wraps to two lines in the two-column layout, leaving a slightly taller
  password row; this is intended because the hint belongs to that field only.
- A production build has not been rerun since this CSS change.

## Decisions needed from the human

- Confirm the 5px radius for inputs (matching the documented "small controls use 5px" rule) rather
  than the previous 10px.

## Status

ready for review

## Human review (filled in by the human only)
   ## Human review (filled in by the human only)
   Decision: approved

