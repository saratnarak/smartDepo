# Task: Fix the R2 smoke test private-object check

## FR IDs

- FR-10 (depot logo storage) and FR-8 (product image storage): verification only. No feature
  behavior was added or changed.
- Links to `docs/reports/015-r2-live-verification.md` and the storage design in
  `docs/reports/013-r2-file-storage.md`. No separate rerun report file exists in `docs/reports/`;
  015 is the latest R2 report.

## Summary

Fixed the unsigned-object check in `apps/api/scripts/r2-smoke.mjs`. The script now downloads the
unsigned response body, treats any non-2xx response without the uploaded PNG bytes as a pass, and
fails only on a 2xx response or a body that contains the uploaded bytes. The R2 S3 endpoint returns
HTTP 400 `InvalidArgument (Authorization)` for an unsigned request, which is now correctly reported
as a pass instead of a failure. The public-object failure hint now points at public bucket access
(`r2.dev` or a custom domain), not at a wrong endpoint.

The live smoke test now passes every step: presigned PUT, presigned GET with byte comparison,
unsigned URL rejection, presigned URL before and after its 2-second expiry, and delete confirmation.
Cleanup remains in the `finally` block, and `cleanedUp` is set only after the delete is confirmed, so
a failed confirmation still triggers a cleanup delete. README guidance was updated to explain the
unsigned-request behavior and that `r2.dev`/custom-domain public access is a separate setting.

No feature code, schema, migration, tenant scope, auth, or frontend code changed.

## Files changed

- `apps/api/scripts/r2-smoke.mjs`: unsigned-URL check now compares the response body against the
  uploaded PNG; non-2xx responses without the bytes pass; the failure hint no longer says the
  endpoint is wrong; `cleanedUp` is set only after the 404 confirmation.
- `README.md`: explained that the S3 API endpoint rejects unsigned requests and that public access
  through an `r2.dev` address or a custom domain is a separate setting that must stay disabled.
- `docs/reports/016-r2-smoke-fix.md` (this report).

No other files changed. No new dependency was added.

## Tests run

- `pnpm r2:smoke` — **PASS**:
  - `presigned PUT upload` — HTTP 200.
  - `presigned GET download and byte comparison` — HTTP 200; 75 bytes match.
  - `unsigned object URL is not public` — HTTP 400; rejected without the uploaded bytes.
  - `presigned URL before 2-second expiry` — HTTP 200.
  - `presigned URL after 2-second expiry is rejected` — HTTP 403.
  - `object deleted and no longer readable` — HTTP 404.
  - `RESULT: PASS`.
- `pnpm format:check` — passed: all files use Prettier style.
- `pnpm lint` — passed for API and web.
- `pnpm test` — passed: API 14 suites / 87 tests; web 16 suites / 66 tests.
- `pnpm build` — passed: NestJS API and Next.js production build (19 routes).
- `pnpm --filter api test:tenant` — not run. This task changes no database, tenant-scope, or API
  behavior.
- Browser CORS check — not run. The smoke test runs in Node and cannot exercise the browser
  preflight; the manual DevTools procedure remains in `README.md`.
- Failure-path cleanup was not exercised by injecting an error; the live run passed and deleted its
  object. Code review confirms the cleanup delete is in `finally` and runs after any confirmed
  upload while the delete has not been confirmed.

## Security check

- No `.env` content was printed, copied, or added to git. The smoke script loads the variables into
  `process.env` through dotenv and prints only PASS/FAIL, HTTP status codes, and redacted errors;
  signed URLs and credential values are redacted.
- The script uses only the `smoke-test/` prefix. The live run created one object and confirmed its
  deletion with HTTP 404.
- The unsigned check now reads the response body and compares it with the uploaded PNG. A 2xx
  response or a body containing those bytes fails the check; an error response without them passes.
- The failure hint for the unsigned step now concerns public bucket access, not the endpoint.
- No feature code, guard, tenant scope, database access, or dependency was changed.

## Open issues / risks

- The HTTP 400 `InvalidArgument (Authorization)` from the S3 endpoint is expected for an unsigned
  request and is not evidence of a wrong endpoint. Public access through an `r2.dev` address or a
  custom domain is a separate Cloudflare setting; it is not tested by the script and must stay
  disabled.
- The smoke test is a manual, credential-dependent check. It should not run in CI without a dedicated
  test bucket and a secret store.
- Browser CORS is still unverified; it requires a real browser upload through the web app.
- No separate rerun report file was found in `docs/reports/`. This report links to 015 and records
  the current live result.
- The 2-second expiry check depends on the local clock. It passed with HTTP 403 after expiry; the
  clock is not a blocker at this time.

## Decisions needed from the human

- Confirm that public access through `r2.dev` and any custom domain is disabled for this bucket.
- Confirm whether the manual browser CORS check should be run before the demo.
- Confirm whether a separate rerun report was expected; none exists in `docs/reports/`.

## Status

ready for review

## Human review (filled in by the human only)
Decision: approved
Notes:
