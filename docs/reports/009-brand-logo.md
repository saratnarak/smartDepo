# Task: SmartDepo brand logo assets

## FR IDs

- No new PRD feature behavior. The logo appears on the FR-1 registration screen, the FR-6 login
  screen, and the app shell used by the FR-2/FR-5 Platform Admin screens.
- No API, database, or authorization change.

## Summary

Recreated the chosen SmartDepo mark as four hand-written SVGs: the two-colour logo, a white-on-teal
app icon, a single-colour `currentColor` version, and a simplified favicon. The mark uses the
requested teal `#0F6B62` and orange `#F2B880`, with a rounded warehouse outline, three notched
cartons, and three rising bars. The main logo is now shown through the shared `Brand` component on
the login, register, and other auth screens and in the app shell sidebar, replacing the `SD` square.

The favicon and app icon are declared in the root layout metadata, so `/login` renders the shortcut,
icon, and apple-touch-icon links. All assets are static files under `apps/web/public/brand/`, served
from the same origin.

## Files changed

New assets:

- `apps/web/public/brand/logo-mark.svg` — 128 × 128 viewBox, teal warehouse outline and cartons,
  orange bars, transparent background.
- `apps/web/public/brand/logo-app-icon.svg` — 512 × 512 rounded teal square (`rx="116"`) with the
  white version of the mark.
- `apps/web/public/brand/logo-mono.svg` — same geometry using `currentColor` for the stroke and fills.
- `apps/web/public/brand/favicon.svg` — 32 × 32 simplified mark: thicker house outline, cartons
  without notches, and the three bars merged into one stepped orange shape so it survives 16 px.

Application wiring:

- `apps/web/src/components/brand.tsx` — renders `logo-mark.svg` with `next/image`, a 52 × 52
  display size, `priority`, `unoptimized`, and `alt={t('app.name')}`. The visible brand text is
  hidden from assistive technology because the image alt already names the home link.
- `apps/web/src/app/layout.tsx` — `applicationName` and `icons` metadata for the SVG favicon,
  shortcut icon, and apple-touch icon.
- `apps/web/src/app/globals.css` — `.brand__mark` is now a plain 52 px image instead of the teal
  gradient `SD` tile; the sidebar adds a white rounded tile and shadow so the teal mark keeps
  contrast on the dark sidebar.

Report:

- `docs/reports/009-brand-logo.md` (this report).

## Tests run

- `pnpm format:check` — passed ("All matched files use Prettier code style").
- `pnpm lint` — passed for API and web.
- `pnpm test` — passed: API 11 suites / 65 tests; web 5 suites / 18 tests.
- `pnpm build` — passed: Next.js production build (14 dynamic routes) and NestJS build.
- Production smoke check with `pnpm exec next start -p 3100`:
  - `/login` HTML contained `rel="shortcut icon"`, `rel="icon" type="image/svg+xml" sizes="any"`,
    and `rel="apple-touch-icon"` pointing at the brand assets.
  - `/brand/favicon.svg`, `/brand/logo-mark.svg`, and `/brand/logo-app-icon.svg` returned HTTP 200.
  - The temporary production server was stopped after the check.
- Visual checks with headless Chrome:
  - All four SVGs rendered correctly at large sizes; the mono file rendered in white when given a
    white `color`.
  - `/login` and `/register` at 1100 × 900/950: logo aligned with the two-line brand text.
  - `/platform/depots` at 1440 × 1000: sidebar logo readable on the dark background.
  - `favicon.svg` inspected as actual 16 px and 32 px rasterizations; the house, carton stack, and
    orange bars remain distinguishable.
- `pnpm --filter api test:tenant` was not run: this task changes no depot data, backend code, or
  database access.
- Both local dev servers were stopped before the production build; neither is running now.

## Security check

- Static hand-written SVG files only. They contain no scripts, `foreignObject`, external references,
  event handlers, or embedded fonts, and are served from the app's own origin.
- `next/image` is used with `unoptimized` because the source is already a vector; this avoids the
  image optimizer and the SVG optimizer configuration. It does not introduce remote image loading.
- No new endpoints, guards, queries, tenant scope, tokens, or secrets were added.
- The logo carries `alt="SmartDepo"` and the visible brand text is hidden from assistive technology,
  so the home link has one accessible name and the tagline does not repeat. No user-facing strings
  were added, so `km.json` and `en.json` are unchanged.
- SVG source files are text and were validated with `xmllint --noout` (all four valid).

## Open issues / risks

- The apple-touch icon is declared as an SVG. iOS does not support SVG apple-touch icons, so a
  180 × 180 PNG would be needed for a polished iOS home-screen icon. The four requested deliverables
  are SVG only; no binary assets were added.
- The browser also requests `/favicon.ico` as a fallback in some older clients; no `.ico` file was
  added because the requested favicon is `favicon.svg`. Modern browsers use the declared link.
- The sidebar uses the two-colour logo on a white rounded tile to keep contrast on the dark
  background. If the design should use the mono file there instead, that is a one-line change.
- The 52 px logo size and the sidebar tile treatment are design choices made to keep the mark
  balanced with the two-line brand text; they have not been reviewed by a designer.
- The attached source image is present as an untracked `smartdepo-logo.png` in the repository root.
  It was not added, moved, or deleted. The human can decide whether to keep it.
- The duplicate `006` report numbering (`006-swagger-api-docs.md` and
  `006-staff-passwords-and-depot-settings.md`) remains unresolved from earlier tasks.

## Decisions needed from the human

1. Confirm the 52 px brand display size and the white tile behind the logo in the dark sidebar.
2. Decide whether to add a 180 × 180 PNG apple-touch icon and/or a `favicon.ico` fallback before the
   final demo.
3. Decide whether to keep or remove the untracked `smartdepo-logo.png` source image.
4. Decide how to resolve the duplicate `006` report number.

## Status

ready for review

## Human review (filled in by the human only)
Decision: approved