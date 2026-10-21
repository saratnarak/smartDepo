# Task: Live Cloudflare R2 verification

## FR IDs

- FR-10 (depot logo storage) and FR-8 (product image storage): verification only. No feature behavior
  was added or changed.
- Follows the storage implementation in `docs/reports/013-r2-file-storage.md` and the credential
  decision recorded there.

## Summary

Added `apps/api/scripts/r2-smoke.mjs`, a `r2:smoke` pnpm script, and README instructions for the
live smoke test and a manual browser CORS check. The script uses the real `R2StorageProvider`, not
the in-memory test provider, and covers presigned upload, presigned download with byte comparison,
an unsigned object URL, presigned URL expiry, delete, and delete confirmation.

The smoke test was run against the configured bucket. It failed at the first step: the presigned PUT
returned HTTP 403 `AccessDenied`. The failure is a credential/bucket-permission problem, not a code
bug. A read-only diagnostic showed that a presigned GET for a missing `smoke-test/` key returned HTTP
404 `NoSuchKey` (signature, endpoint, account, and bucket are accepted for reads), while PUT and
DELETE both returned HTTP 403 `AccessDenied`. The local clock was 1 second ahead of the R2 `Date`
header. The most likely cause is a read-only R2 token or a bucket policy that denies writes/deletes;
wrong endpoint, wrong bucket name, and clock skew were ruled out by the checks. No object was
uploaded, so the run created no `smoke-test/` object. Steps b-e could not run.

No feature code was changed: the failure is outside the application code.

## Files changed

- `apps/api/scripts/r2-smoke.mjs` (new): real-provider smoke test with a generated 2×2 PNG,
  presigned PUT/GET, byte comparison, private-object check, 2-second expiry check, delete, and
  delete confirmation. Errors redact credential values, URLs, and signatures; only PASS/FAIL, HTTP
  status codes, and sanitized R2 error codes/messages are printed.
- `apps/api/package.json`: added `r2:smoke`.
- `package.json`: added root `r2:smoke` forwarding to the API package.
- `README.md`: added the smoke-test procedure, expected permissions, failure guidance, and the
  manual browser CORS check.
- `docs/reports/015-r2-live-verification.md` (this report).

No API source, schema, migration, tenant scope, auth, or frontend feature code changed.

## Tests run

- `pnpm r2:smoke` — **FAIL** at step 1.
  - `presigned PUT upload`: HTTP 403 `AccessDenied` (`Access Denied`).
  - No object was uploaded, so no cleanup delete was attempted by the script.
- Read-only diagnostic (temporary script, deleted after use; no object created):
  - Presigned GET for a missing `smoke-test/` key: HTTP 404 `NoSuchKey`.
  - Presigned PUT for a `smoke-test/` key: HTTP 403 `AccessDenied`.
  - `DeleteObject` for a missing `smoke-test/` key: HTTP 403 `AccessDenied`.
  - `InspectObject` for a missing key: returned `null` (not found).
  - Clock check using the R2 `Date` header: local clock ahead by 1 second.
  - Endpoint/bucket shape check: HTTPS R2 host, no path/query, endpoint host starts with the
    configured account id, valid bucket name, 32-character access key id, 64-character secret.
- `.env` checks:
  - `git check-ignore -v .env` — `.gitignore:20:.env` (ignored).
  - `git ls-files --error-unmatch .env` — not tracked.
- Credential scan (exact R2 values plus non-placeholder `R2_*` assignments and signed-URL query
  parameters, across repository files outside `.env`, dependencies, generated output, and build
  output): 270 files scanned, 0 matches. The final scan also covers this report.
- `pnpm format:check` — passed: all files use Prettier style.
- `pnpm lint` — passed for API and web.
- `pnpm test` — passed: API 14 suites / 87 tests; web 16 suites / 66 tests.
- `pnpm build` — passed: NestJS API and Next.js production build (19 routes).
- `pnpm --filter api test:tenant` — not run. This task changes no database, tenant-scope, or API
  behavior.
- Browser CORS check — not run because the presigned PUT is currently denied; the manual procedure
  is documented in `README.md`.

## Security check

- No `.env` content was printed, copied, or added to git. The smoke script and scans loaded it into
  `process.env` and compared values in memory without displaying them; only non-empty checks and
  structural booleans were shown.
- The smoke script loads the five R2 variables from the environment, redacts their values and any
  URL/signature from errors, and never prints presigned URLs or credentials.
- The script uses only keys under `smoke-test/`. It deletes in `finally` after a successful upload
  and confirms deletion with a presigned GET expecting HTTP 404. The failed run uploaded nothing.
- `.env` is ignored at `.gitignore:20` and is not tracked. The credential scan found no R2 values,
  non-placeholder `R2_*` assignments, or signed-URL parameters in repository files outside `.env`.
- No feature code, guard, tenant scope, database access, or dependency was changed.
- The smoke script requires a private bucket and a token with Object Read & Write. The current token
  can read the bucket but cannot write or delete.

## Open issues / risks

- **Live R2 write/delete is blocked.** The first smoke-test step fails with HTTP 403 `AccessDenied`.
  The read-only diagnostic rules out the endpoint, account id, bucket name, and clock: a presigned GET
  for a missing key returns `404 NoSuchKey`, and the local clock is within 1 second. The remaining
  likely cause is a read-only token or a bucket policy denying `PutObject`/`DeleteObject`.
- Steps b-e (download comparison, private-object check, expiry, delete, delete confirmation) did not
  run, so there is no live evidence for them yet.
- Browser CORS has not been verified. The script runs server-side and cannot exercise the browser
  preflight. The README now documents the manual DevTools check.
- The smoke test is a manual credential-dependent check; it should not run in CI without a dedicated
  test bucket and secret store.
- The failure hint for `AccessDenied` is intentionally generic because the same code can mean token
  scope or a bucket policy. The diagnostic in this report is the evidence needed to choose the fix.
- No product/depot image upload end-to-end flow was exercised against the live bucket.

## Decisions needed from the human

- Update the R2 API token to **Object Read & Write** for this bucket (or fix the bucket policy to
  allow `PutObject` and `DeleteObject`), then rerun `pnpm r2:smoke`.
- Confirm whether `r2:smoke` should be added to the pre-demo checklist rather than CI.
- After write access works, run the manual browser CORS check from the README and confirm the
  allowed origin list (`http://localhost:3000` plus the production origin).
- Confirm whether the bucket policy or token scope was the intended cause after the fix.

## Status

ready for review

## Human review (filled in by the human only)
Decision: approved
Notes:
