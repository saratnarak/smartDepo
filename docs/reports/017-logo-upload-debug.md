# Task: Logo upload debug (browser to R2)

## FR IDs

- FR-10 (depot settings: name, logo, address, currency, language, invoice footer)

## Summary

The real upload never happened in the reported browser flow. `ImageUpload` only validated the
file and created a local blob preview when the file was chosen. The only code that called
`POST /storage/logo/upload-url`, the direct R2 `PUT`, and `POST /storage/logo/confirm` was the
separate **Upload** button. **Save settings** only called `PATCH /depot/settings`, so it could
successfully show "Depot settings saved" while the bucket stayed empty.

The settings form now calls the image upload/confirm flow before saving. If the upload or confirm
fails, it does not call `PATCH /depot/settings` and does not show the success message. The component
now shows stage-specific Khmer/English errors for an invalid file type or size, a failed presign,
a CORS/network failure on the direct PUT, an HTTP rejection from storage, a failed confirm, and a
failed preview read. After confirm, it requests a presigned read URL and displays the R2 image; on
page reload it requests the read URL again from the saved `logoKey`.

A second, independent browser blocker was found: a one-off `OPTIONS` preflight against a real
presigned R2 URL with `Origin: http://localhost:3000` returned HTTP 403 with no
`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, or `Access-Control-Allow-Headers`
headers. The Node smoke test cannot see this because it does not apply browser CORS. No Cloudflare
setting was changed. The exact rule to add is in "Open issues / risks".

## Files changed

- `apps/web/src/components/image-upload.tsx`: exposes an imperative `upload()` handle, performs the
  direct PUT with `fetch`, maps each failure stage to a translated message, and switches to the
  presigned R2 read URL after confirm instead of leaving the blob preview.
- `apps/web/src/components/image-upload.spec.tsx`: covers successful upload/confirm/read, CORS and
  network failure, HTTP rejection, confirm failure, and reload from a saved `logoKey`.
- `apps/web/src/features/depot-settings/depot-settings-form.tsx`: calls the image upload before
  `PATCH /depot/settings`; blocks the save and the success message when the image fails.
- `apps/web/src/features/depot-settings/depot-settings-form.spec.tsx`: covers upload-before-save,
  "not saved" on upload failure, and loading the saved logo from R2 after a reload.
- `apps/web/src/i18n/en.json`, `apps/web/src/i18n/km.json`: added the upload failure, confirm
  failure, preview failure, in-progress, and "settings not saved" messages in both languages.
- `apps/api/src/modules/storage/storage.module.ts`: exported `createStorageProvider` so the
  provider choice can be asserted without contacting R2.
- `apps/api/test/storage-provider.spec.ts`: asserts the in-memory provider only for
  `NODE_ENV=test` and the real R2 provider outside tests.
- `README.md`: documents that Save settings starts the logo upload, and lists the exact bucket CORS
  JSON including `http://127.0.0.1:3000`.

## Tests run

- `pnpm format:check` - passed, "All matched files use Prettier code style!".
- `pnpm lint` - passed for `apps/api` and `apps/web`.
- `pnpm test` - passed: web 16 suites / 74 tests; API 15 suites / 89 tests.
- `pnpm build` - passed: `next build` (19 routes) and `nest build`.
- One-off CORS preflight diagnostic (temporary `tsx` script under `apps/api/scripts`, deleted after
  use): generated a presigned PUT URL, sent `OPTIONS` with `Origin: http://localhost:3000`,
  `Access-Control-Request-Method: PUT`, and `Access-Control-Request-Headers: content-type`. Result:
  HTTP 403, with no `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, or
  `Access-Control-Allow-Headers`. The script printed only the status and CORS headers, never the
  signed URL or credentials.
- Not run separately: `pnpm --filter api test:tenant`. No depot query, tenant scope, or tenant-owned
  API code was changed.
- Not rerun: `pnpm r2:smoke`. The storage provider code was not changed; report 016 records the last
  live smoke-test pass. The CORS diagnostic above did use the real R2 credentials to presign a URL,
  so the real provider path is reachable.
- Live browser retest after the fix: choosing a PNG and clicking **Save settings** produced the
  browser `OPTIONS` preflight to the presigned bucket URL with HTTP 403. The response had no
  `Access-Control-Allow-Origin` (content type `application/xml`). The UI showed both "Could not
  upload the image to storage..." and "Settings were not saved because the logo upload failed...";
  it did not show the success message. This confirms the new guard works and isolates the remaining
  failure to the missing bucket CORS rule.

## Security check

- No endpoint, role guard, or tenant-scope code changed. The logo endpoints remain OWNER-only, and
  the server still builds object keys from the token depot.
- No new cross-tenant test was needed because no new endpoint or depot query was added. The existing
  `test:tenant` suite was not run for the same reason.
- Component tests mock the API client and `fetch`; the API provider test constructs the R2 provider
  but never calls it. No test contacts real R2.
- No `.env` contents, credentials, tokens, or signed URLs were printed, copied, or committed.
- The browser still cannot choose an arbitrary storage key: it sends only the content type, then
  passes the key returned by the server to confirm.

## Open issues / risks

- **Browser uploads remain blocked until the bucket CORS rule is corrected.** The bucket did not
  answer the preflight for `http://localhost:3000`. Add or replace the bucket CORS policy with:

  ```json
  [
    {
      "AllowedOrigins": ["http://localhost:3000", "http://127.0.0.1:3000"],
      "AllowedMethods": ["PUT", "GET"],
      "AllowedHeaders": ["Content-Type"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
  ```

  Add the production web origin as another exact origin (scheme, host, and port; no trailing slash).
  The direct PUT needs `PUT` and `Content-Type`; `GET` is included for completeness. After changing
  the rule, fully reload the page before retrying because browsers cache preflight results.
- End-to-end browser persistence could not be verified because of that CORS blocker. The success
  path (upload, confirm, presigned read URL, and reload using `logoKey`) is covered by tests with
  mocked network calls. The real API confirm/read endpoints and their existing tests are unchanged.
- The separate **Upload** button still works for an immediate upload. If Save is clicked while that
  upload is still running, the save is blocked with an in-progress message. If the user clears the
  failed image, a later settings save is allowed because no image is pending.
- Product image uploads use the same component and will also fail in the browser until the same CORS
  rule exists. The product form was not changed to block its text-field save on an image failure;
  that is outside this logo task.

## Decisions needed from the human

- Add the CORS rule above and provide the production web origin if it differs from localhost.
- After adding it, retry the logo upload in the browser and confirm the `OPTIONS` request returns
  200/204 followed by a `PUT` 200.

## Human review (filled in by the human only)

Decision: approved
Notes:
