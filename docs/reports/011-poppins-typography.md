# Task: Poppins typography with 400 and 500 weights

## FR IDs

No PRD feature ID. This is a UI typography change. It follows the AGENTS.md requirements for Khmer and English rendering (section 8) and consistent frontend styling (section 9).

## Summary

Changed the web UI font to Poppins and limited the loaded font weights to 400 and 500. All existing CSS weights above 500 were normalized to 500, the base body text is 400, and headings, `strong`, `b`, and `th` are explicitly 500 so browser defaults cannot introduce a heavier weight. Noto Sans Khmer remains the fallback for Khmer glyphs because Poppins does not include Khmer characters.

## Files changed

- `apps/web/src/app/globals.css`: Google Fonts import now loads Poppins 400/500 and Noto Sans Khmer 400/500; body font family is Poppins with Noto Sans Khmer fallback; all font weights are 400 or 500.
- `docs/reports/011-poppins-typography.md`: this report.

## Tests run

- `pnpm format:check` — passed: all files use Prettier style.
- `pnpm lint` — passed for both `apps/api` and `apps/web`.
- `pnpm test` — passed:
  - API: 11 suites, 65 tests.
  - Web: 10 suites, 38 tests.
- `pnpm build` — passed for API and web.
- Headless Chrome checks on the login, platform review, staff, settings, and change-password pages:
  - Computed body font family begins with `Poppins`, with `Noto Sans Khmer` next.
  - Poppins 400 and 500 are loaded.
  - Noto Sans Khmer 400 and 500 are loaded when Khmer text is displayed.
  - No visible element computed a font weight other than 400 or 500.
  - English and Khmer screenshots at 1440 px and 390 px showed correct rendering.
  - The pages had no page-level horizontal overflow; the staff table keeps its existing scrollable table area on phone widths.

## Security check

No security impact. This change only updates CSS font loading and weights. No authentication, authorization, tenant scope, API, database, or secret handling changed. Fonts continue to come from Google Fonts, as before.

## Open issues / risks

- Poppins has no Khmer glyphs, so Khmer text uses the Noto Sans Khmer fallback. This is intentional and required for correct Khmer rendering.
- Fonts are still loaded from Google Fonts at runtime. A fully offline or restricted deployment would need the font files self-hosted. This was already true before this change.
- The login page font request adds Poppins 400/500 and Noto Sans Khmer 400/500; the previous Inter 400/500/600/700 request is removed.

## Decisions needed from the human

None.

## Status

ready for review

## Human review (filled in by the human only)
Decision: approved
Notes:
