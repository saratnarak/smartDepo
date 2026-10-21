# Task: Frontend for the plans and the audit log

## FR IDs

- FR-4: the plan of the depot with the usage against the limits, and the limit messages.
- FR-50: the audit log of the depot and the audit log of the platform.
- FR-51: the owner can read and filter the audit log, and the log cannot be edited or deleted.

## Summary

Added the screens of the plans and the audit log on top of the API of report 024. The owner sees the
plan of the depot on the settings page with the usage against the limits as two progress bars, the
price of the plan for display, and a clear message when a limit is reached. The Platform Admin sees
the plan of every depot in the depot review and can move a depot to another plan with a dialog that
uses the real route of the API. The audit log has its own page for the owner and one for the
platform: a table with the time, the user, the action, and the record, filters for the action, the
user, the type of record, and the period, sorting on three columns, and paging. The details of an
entry are shown as keys and values, never as raw JSON, and there is no control to change or to remove
an entry anywhere.

The dashboard was polished: the "Try again" button only shows when the loading failed, and a small
refresh button replaces it otherwise. The empty chart boxes now show a neutral icon with a short
message instead of a "0" badge.

One small change to the API was needed and is listed below: the depot list of the platform did not
carry the plan of the depot, so the response got one additive field.

## Files changed

New:

- `apps/web/src/features/plans/plan-usage.ts`: the helpers of the usage bars (the percent, the
  remaining places, the limit that is reached).
- `apps/web/src/features/plans/plan-card.tsx`: the plan card of the settings page.
- `apps/web/src/features/plans/plan-usage.spec.ts`: the unit tests of the usage bars.
- `apps/web/src/features/plans/plan-card.spec.tsx`: the component test of the plan card.
- `apps/web/src/features/audit-log/audit-filters.ts`: the filters, the actions, and the types of
  record of the API, and the helpers that turn the filters into the query of the API.
- `apps/web/src/features/audit-log/audit-details.ts`: the rows of the details of an entry, so the
  screen never shows raw JSON.
- `apps/web/src/features/audit-log/audit-log-manager.tsx`: the page of the audit log of the depot and
  of the platform.
- `apps/web/src/features/audit-log/audit-filters.spec.ts` and `audit-details.spec.ts`: the unit tests
  of the filters and of the details.
- `apps/web/src/features/audit-log/audit-log-manager.spec.tsx`: the component test of the page.
- `apps/web/src/app/(app)/audit-log/page.tsx` and `src/app/(app)/platform/audit-log/page.tsx`: the
  two routes.

Changed:

- `apps/web/src/lib/types.ts`: the types of the plans, of the plan of the depot, and of the audit
  log entries, and the plan of a depot in the depot list.
- `apps/web/src/lib/api-client.ts`: the clients of the plan, of the plans of the platform, of the
  plan change, and of the two audit log lists.
- `apps/web/src/lib/permissions.ts`: `plan.read`, `platform.plans.read`, `platform.plans.manage`,
  `audit.log.read`, and `platform.audit.log.read`.
- `apps/web/src/lib/errors.ts`: the message for the product limit of the plan
  (`PLAN_PRODUCT_LIMIT_REACHED`); the message for the user limit already existed.
- `apps/web/src/lib/navigation.ts` and `src/components/app-shell.tsx`: the entry of the audit log for
  the owner, the entry of the platform audit log for the Platform Admin, the route guard of
  `/audit-log`, and the icon of the log.
- `apps/web/src/app/(app)/settings/page.tsx`: the plan card below the settings, for the owner.
- `apps/web/src/app/(app)/platform/depots/page.tsx`: the column of the plan and the dialog of the
  plan change.
- `apps/web/src/features/dashboard/dashboard-manager.tsx`,
  `src/features/platform-dashboard/platform-dashboard-manager.tsx`, and
  `src/features/dashboard/dashboard-charts.tsx`: the refresh button and the empty chart box.
- `apps/web/src/components/app-shell.spec.tsx` and `src/lib/navigation.spec.ts`: the tests of the
  role-based navigation.
- `apps/web/src/i18n/en.json` and `src/i18n/km.json`: every new label in both languages (1076 keys
  each, in sync).
- `apps/web/src/app/globals.css`: the plan card, the usage bars, the audit values, and the refresh
  button.
- `apps/api/src/modules/platform-admin/platform-admin.service.ts` and
  `dto/depot-admin-view.dto.ts`: the plan of the depot in the answer of the depot list (one additive
  field; no new permission and no breaking change).
- `apps/api/test/plans-audit.db.tenant-spec.ts`: the test of the new field.

## Tests run

- `pnpm format:check` — passed.
- `pnpm lint` — passed for API and web.
- `pnpm test` — passed: API 21 suites / 130 tests; web 35 suites / 195 tests (the web had 30 suites
  and 162 tests before this task).
- `pnpm --filter api test:tenant` — passed: 10 suites / 137 tests.
- `pnpm build` — passed for NestJS and Next.js.

### Live check against the running backend

Yes. The API ran on `http://localhost:3001` with the development database and the Next.js app on
`http://localhost:3000`, with the three demo depots of report 022. A temporary Playwright script
(deleted afterwards) drove the screens with the owner of the demo beer depot and with the Platform
Admin:

- The settings page showed the plan card of the demo beer depot: the plan Pro, the price 49 KHR a
  month, and the two usage bars (3 of 50 staff accounts and 4 of 1000 products).
- The audit log page of the owner loaded 20 entries with the time, the user, the action, and the
  record, the three filter lists, and the two date fields. The details dialog showed the values of
  the entry as keys and values, without the raw JSON.
- The Khmer view of the audit log rendered with Noto Sans Khmer, and the phone layout (iPhone 13)
  stacked the filters and the table.
- The depot review of the Platform Admin showed the plan of every depot (Basic, Pro, Free Trial) with
  a "Change the plan" button; the dialog showed the depot, the plans of the platform, and the
  warning that the change is written to the audit log of the depot.
- No error was logged in the browser.

## Security check

- The screens only call the endpoints of report 024, and the API stays the real guard: the plan of
  the depot, the audit log of the depot, and the audit log of the platform each need their own
  permission, and the navigation only hides what the role may not read.
- The plan card is only rendered for the owner, the audit log of the depot is only in the navigation
  of the owner, and the audit log of the platform is only in the navigation of the Platform Admin.
  The tests of the navigation check that the sales staff, the stock keeper, and the delivery staff
  see neither of them.
- The details of an entry are rendered as keys and values, and React escapes every value, so the
  screen cannot show a raw JSON blob and cannot inject markup.
- The page has no control to change or to remove an entry, and the API has no such route.
- The plan change uses the real route of the API and the confirmation dialog asks before it writes.
- No token, secret, or real personal data was added. The live check used the demo depots and the
  local Platform Admin of the development environment.

## Open issues / risks

- The depot list of the platform did not carry the plan of the depot, and no endpoint returns the
  plan of another depot, so the plan column could not be built with the existing API. The answer of
  the list got one additive field (`plan: { code, name } | null`); the route, the permission, and
  the shape of the other fields did not change, and the other platforms of the depot list are
  untouched. This is the only change to the API in this task.
- The filter of the user of the audit log of the platform only offers the Platform Admin of the
  session, because there is no endpoint that lists the Platform Admins. The filter of the user of the
  depot lists the staff of the depot and the owner.
- The audit log has no free text search over the details of an entry, and the API has no filter for
  the IP address or for the entity id.
- The plan card is shown on the settings page of the owner. The stock keeper and the sales staff do
  not see the plan of the depot, because the API only lets the owner read it.
- The messages of the limits name the limit and the number of places, but they do not link to the
  platform admin, because a depot user cannot ask for a plan from the interface.
- The API answers a plan change with the whole plan of the depot; the screen only uses the notice.

## Decisions needed from the human

- Confirm that the depot list of the platform may show the plan of every depot, and that this small
  addition to the answer of the API is acceptable.
- Confirm that the Platform Admin of the session is the only user the platform log can be filtered
  by, until there is an endpoint that lists the Platform Admins.
- Confirm that the plan card stays on the settings page of the owner, and not on the dashboard of
  the sales staff and the stock keeper.

## Status

ready for review

## Human review (filled in by the human only)
Decision: pending
Notes:
