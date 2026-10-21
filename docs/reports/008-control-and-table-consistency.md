# Task: Shared control states and table action alignment

## FR IDs

- FR-2: Platform Admin depot review table (action column alignment).
- No behavior or API change; follows up the auth form fix in
  `docs/reports/007-auth-form-consistency.md`.

## Summary

Finished the visual consistency pass started in report 007. Disabled `select` controls now use the
same disabled styling as buttons and text inputs, and invalid `select` fields get the same danger
border as invalid inputs and textareas. The Platform Admin depot table's "Actions" header is now
right-aligned with its buttons; it previously stayed left-aligned because `.data-table th` is more
specific than `.data-table__actions`.

## Files changed

- `apps/web/src/app/globals.css`: added `select:disabled` to the shared disabled rule, added
  `select[aria-invalid='true']` to the invalid-field rule, and raised the specificity of the table
  action column alignment.
- `docs/reports/008-control-and-table-consistency.md` (this report).

## Tests run

- `pnpm format:check` — passed.
- `pnpm lint` — passed (API and web).
- `pnpm --filter web test` — passed: 5 suites / 18 tests.
- Visual check with headless Chrome screenshots against the running dev server:
  - `/platform/depots` at 1440×1000: the "Actions" header now aligns with the Approve/Reject
    buttons on the right edge of the column.
  - `/platform/depots` at 390×844: layout and controls unchanged apart from the alignment fix.
  - `/pending`, `/rejected`, `/suspended`: status screens unchanged.
- `pnpm build` was not rerun because the Next dev server was running; Next recompiled the page
  successfully when the screenshots were taken. The change is CSS-only.

## Security check

- CSS-only change. No endpoint, guard, query, tenant scope, or auth behavior was touched.
- No new user-facing strings, so `km.json` and `en.json` are unchanged.

## Open issues / risks

- `docs/reports/006-swagger-api-docs.md` and `docs/reports/006-staff-passwords-and-depot-settings.md`
  still share report number 006. Renaming is a human decision; no report was renamed here.
- The mobile depot table relies on horizontal scrolling for the remaining columns, as before this
  task.

## Decisions needed from the human

- Confirm that disabled and invalid select styling should stay on the shared form rules (the app has
  no select-heavy screen yet).
- Decide how to resolve the duplicate 006 report number.

## Status

ready for review

## Human review (filled in by the human only)
   Decision: approved
