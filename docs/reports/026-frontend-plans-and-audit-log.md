# Task: Frontend for the plans and the audit log (second pass)

## FR IDs

- FR-4: the plan of the depot with the usage against the limits, and the messages that name a limit.
- FR-50: the audit log of the depot and the audit log of the platform.
- FR-51: the owner reads and filters the audit log, and the log cannot be edited or deleted.

## Summary

Report 025 already built the screens of the plans and of the audit log on the API of report 024. This
report is the second pass over that work: the screens were checked against the PRD and against the
real API, and the gaps that were found were closed. The date filter of the audit log now covers the
whole day in the time of the depot (before, the last day was cut at midnight and the first day lost
its morning), the time column of the log shows the hour and the minute instead of the date only, the
audit log has a refresh button like the dashboard and keeps the "Try again" button only for a failed
loading, the empty state of the log has the neutral icon instead of a "0" badge, and the plan card
says how many places are left before a limit is reached. The dialog of the plan change of the
Platform Admin moved to its own component, shows the limits of the plan that is picked, and confirms
before it calls the API. The frontend is the only thing that changed; the API of report 024 was not
touched.

## Files changed

New:

- `apps/web/src/components/empty-mark.tsx`: the neutral mark of an empty state (a list or a chart),
  shared by the audit log and by the empty boxes of the dashboard.
- `apps/web/src/features/platform-depots/plan-change-dialog.tsx`: the confirmation of the plan change
  of a depot, with the plan, the limits of that plan, and the confirm button.
- `apps/web/src/features/platform-depots/plan-change-dialog.spec.tsx`: the component test of that
  dialog.
- `apps/web/src/lib/errors.spec.ts`: the unit tests of the messages of the API, including the two
  plan limits.
- `apps/web/src/lib/format.spec.ts`: the unit tests of the date and the time of the depot.

Changed:

- `apps/web/src/features/audit-log/audit-filters.ts` and `audit-filters.spec.ts`: the days of the
  period are sent as the first and the last moment of the day in the time of the depot
  (`depotDayStart`, `depotDayEnd`).
- `apps/web/src/features/audit-log/audit-log-manager.tsx` and `audit-log-manager.spec.tsx`: the
  refresh button, the "Try again" button only when the loading failed, the time of the entry in the
  table and in the details, and the neutral mark of the empty state.
- `apps/web/src/features/plans/plan-card.tsx` and `plan-card.spec.tsx`: `aria-valuemax` of the usage
  bars and the number of places that are left.
- `apps/web/src/features/dashboard/dashboard-charts.tsx`: the empty chart box uses the shared mark.
- `apps/web/src/app/(app)/platform/depots/page.tsx`: the plan change uses the new dialog component.
- `apps/web/src/lib/format.ts`: `formatDateTime`, the day and the time of the depot.
- `apps/web/src/lib/api-client.spec.ts`: the tests of the real routes of the plan change and of the
  two audit logs.
- `apps/web/src/i18n/en.json` and `apps/web/src/i18n/km.json`: the new labels in both languages
  (`plan.remaining`, `plan.unlimited`, `platform.planLimits`), and the confirm button of the plan
  change now reads "Confirm the plan change".
- `apps/web/src/app/globals.css`: the mark of the empty state, the stroke of the icon, and the line
  with the places that are left.

## Tests run

- `pnpm format:check` — passed.
- `pnpm lint` — passed for API and web.
- `pnpm test` — passed: API 21 suites / 130 tests; web 38 suites / 216 tests (the web had 35 suites
  and 195 tests before this task).
- `pnpm --filter api test:tenant` — passed: 10 suites / 138 tests.
- `pnpm build` — passed for NestJS and Next.js.

### Live check against the running backend

Yes. The API ran on `http://localhost:3001` with the development database and the Next.js app on
`http://localhost:3000`, with the three demo depots of report 022 (the beer depot has the plan Pro,
the energy and the rice depots have Basic). A temporary Playwright script (deleted afterwards) drove
the screens as the owner of the demo beer depot, as the sales staff of the same depot, and as the
Platform Admin. All 20 checks passed:

- The settings page showed the plan card: the plan Pro, the two usage bars (3 of 50 staff accounts
  and 4 of 1000 products), the places that are left (47 and 996), and `aria-valuemax` on the bar.
- The audit log of the owner showed the time of the entry in the time of the depot
  ("22 Oct 2026, 08:34"), one refresh button and no "Try again" button.
- The filter of the period sent `from=2026-10-01T00:00:00+07:00` and
  `to=2026-10-31T23:59:59.999+07:00`, and the filter of the action sent `action=USER_LOGIN`.
- The details of an entry showed the keys and the values, never a raw JSON, and the dialog had no
  button to change or to remove an entry.
- The Khmer view of the audit log rendered with the Noto Sans Khmer font.
- The sales staff did not see the audit log in the navigation and was sent to `/forbidden` when the
  route was opened by hand.
- The depot review of the Platform Admin showed the plan of every depot, the dialog showed the depot,
  the plans, the warning that the change is written to the audit log, and the limits of the plan
  ("The limits of this plan: 15 staff accounts and 100 products"). The confirm button called the
  real route `PATCH /api/v1/platform/depots/:id/plan`, and the notice of the change appeared.
- The platform audit log of the Platform Admin loaded the entries of the platform.
- The phone layout (390 pixels) of the audit log did not scroll sideways.
- The change of the plan was written to the audit log of the depot: the table `audit_logs` has the
  rows `DEPOT_PLAN_CHANGED` for every change of the live check.

## Security check

- The screens only call the endpoints of report 024. The API stays the real guard: the plan of the
  depot, the audit log of the depot, and the audit log of the platform each need their own
  permission, and the navigation only hides what the role may not read.
- The plan card is only rendered for the owner, the audit log of the depot is only in the navigation
  of the owner, and the audit log of the platform is only in the navigation of the Platform Admin.
  The tests of the navigation and the live check prove that the sales staff, the stock keeper, and
  the delivery staff see neither of them, and the live check sent the sales staff away from
  `/audit-log`.
- The details of an entry are rendered as keys and values, and React escapes every value, so the
  screen cannot show a raw JSON blob and cannot inject markup.
- The page has no control to change or to remove an entry, and the API has no such route.
- The plan change calls the real route of the API and the confirmation dialog asks before it writes.
- The new date filter sends the days of the depot as date-times, never a value that the API would
  read as a moment in another time zone.
- No token, secret, or real personal data was added. The live check used the demo depots, the demo
  passwords of the generator, and the local Platform Admin of the development environment. The
  temporary script with the checks was deleted afterwards.

## Open issues / risks

- Report 025 already delivers the same screens and is still `Decision: pending`. This report is a
  second pass over that work and does not replace it: the human decides whether report 025 is closed
  by this one or whether both stay open.
- The API groups the days of the reports in the time of Phnom Penh, and the audit log now does the
  same on the client. The API compares the entries with `createdAt >= from` and `createdAt <= to`,
  so the client sends the first and the last moment of the day; the two ends have to stay in step.
- The Chromium of the live check has no Khmer locale data, so the dates of the tables are written in
  English inside the Khmer view; Node has the full ICU and shows "22 តុលា 2026". The Khmer text of
  the interface itself is correct. This is the same behaviour as the other screens of the app, which
  use `formatDate` with the same locale tags.
- While driving the screens, `POST /api/auth/refresh` answered 401 a few times. The refresh token is
  rotated by the server and the client refreshes again after a 401 of an API call, so a second
  refresh can arrive with the token that was already replaced. The session recovered every time and
  nothing of this task touches the auth flow; it is reported here and not fixed.
- The filter of the user of the platform log still only offers the Platform Admin of the session,
  because there is no endpoint that lists the Platform Admins.
- The plan card is shown on the settings page of the owner. The sales staff and the stock keeper do
  not see the plan of the depot, because the API only lets the owner read it.
- The audit log has no free text search over the details of an entry, and the API has no filter for
  the IP address or for the id of the record.

## Decisions needed from the human

- Confirm that report 025 is closed by this report, or say which part of it has to stay open.
- Confirm that the depot list of the platform keeps the column of the plan (added in report 025) and
  that the change of the plan may stay in the dialog with the plan and its limits.
- Decide whether the 401 of the session refresh becomes its own task; it is outside the scope of this
  task.

## Status

ready for review

## Human review (filled in by the human only)
Decision: pending
Notes:
