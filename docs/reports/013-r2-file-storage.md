# Task: R2 file storage (depot logo and product images)

## FR IDs

- FR-10 (depot settings, including the depot logo)
- FR-8 (product catalogue, including product images)

## Summary

Added a storage module that issues short-lived presigned upload and read URLs for depot logos and product images using Cloudflare R2 through the S3-compatible API. Object keys are built on the server from the token depot id, and only the key is stored in PostgreSQL. Confirming an upload reads the stored object, verifies the real magic bytes and the 2 MB limit, saves the key, deletes the previous object, and writes an audit entry. All tests use an in-memory provider and never call real R2. Added a reusable Khmer/English image upload component and wired it into depot settings.

## Files changed

Backend:

- `apps/api/package.json` (added `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`, needed for the S3-compatible R2 client and presigned URLs)
- `pnpm-lock.yaml`
- `apps/api/src/app.module.ts`
- `apps/api/src/common/audit/audit-actions.ts` (`DEPOT_LOGO_UPDATED`, `PRODUCT_IMAGE_UPDATED`)
- `apps/api/src/common/auth/permissions.ts` (`storage.logo.manage`, `storage.product.image.manage`)
- `apps/api/src/modules/depots/depot-settings.service.ts` (settings view includes `logoKey`)
- `apps/api/src/modules/depots/dto/depot-settings.dto.ts` (`logoKey`)
- `apps/api/src/prisma/schema.prisma` (`Depot.logoKey`, `Product.imageKey`)
- `apps/api/src/prisma/migrations/20261021150000_storage_image_keys/migration.sql`
- `apps/api/src/modules/storage/storage.provider.ts`
- `apps/api/src/modules/storage/image-validation.ts`
- `apps/api/src/modules/storage/r2-storage.service.ts`
- `apps/api/src/modules/storage/memory-storage.service.ts`
- `apps/api/src/modules/storage/storage.service.ts`
- `apps/api/src/modules/storage/storage.module.ts`
- `apps/api/src/modules/storage/storage.controller.ts`
- `apps/api/src/modules/storage/dto/presign-upload.dto.ts`
- `apps/api/src/modules/storage/dto/confirm-image.dto.ts`
- `apps/api/src/modules/storage/dto/storage-response.dto.ts`
- `apps/api/test/image-validation.spec.ts`
- `apps/api/test/memory-storage.spec.ts`
- `apps/api/test/storage.db.tenant-spec.ts`
- `.env.example` (R2 placeholders only)
- `README.md` (bucket, token, CORS, and endpoint documentation)

Frontend:

- `apps/web/src/lib/types.ts` (`logoKey`, `ImageContentType`, `PresignedUpload`, `PresignedRead`)
- `apps/web/src/lib/api-client.ts` (logo and product image presign/confirm calls)
- `apps/web/src/components/image-upload.tsx`
- `apps/web/src/components/image-upload.spec.tsx`
- `apps/web/src/features/depot-settings/depot-settings-form.tsx` (logo upload)
- `apps/web/src/features/depot-settings/depot-settings-form.spec.tsx` (fixture includes `logoKey`)
- `apps/web/src/i18n/en.json`
- `apps/web/src/i18n/km.json`
- `apps/web/src/app/globals.css`

## API endpoints added

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/v1/storage/logo/upload-url` | OWNER |
| POST | `/api/v1/storage/logo/read-url` | OWNER |
| POST | `/api/v1/storage/logo/confirm` | OWNER |
| POST | `/api/v1/storage/products/:productId/image-upload-url` | OWNER, STOCK_KEEPER |
| POST | `/api/v1/storage/products/:productId/image-read-url` | OWNER, STOCK_KEEPER |
| POST | `/api/v1/storage/products/:productId/image-confirm` | OWNER, STOCK_KEEPER |

## Tests run

All commands were run from the repository root, sequentially.

- `pnpm format:check` — passed ("All matched files use Prettier code style!").
- `pnpm lint` — passed (web and API, 0 errors, 0 warnings).
- `pnpm test` — passed: API 14 suites / 87 tests, web 11 suites / 41 tests.
- `pnpm --filter api test:tenant` — passed: 6 suites / 84 tests against `smartdepo_test` only (the test setup refuses other databases).
- `pnpm build` — passed for both `apps/api` and `apps/web`.
- `pnpm --filter api exec prisma migrate deploy` — applied `20261021150000_storage_image_keys` to the development database; 8 migrations total.
- `pnpm --filter api exec prisma validate` — schema valid.

New tests cover: magic-byte detection, extension mapping, the in-memory provider, unauthenticated requests (401), forbidden roles (403 for STOCK_KEEPER on logo and SALES on product images), invalid content type (400), oversize object (400), non-image bytes (400), missing object (404), logo upload/replace with old-object deletion, product image upload/read/confirm, audit entries, and wrong-depot product ids and keys (404/400).

## Security check

- Every storage endpoint has an explicit `@RequirePermissions` guard; there is no unguarded route.
- The depot id used in keys and lookups comes only from the access token, never from the body, query, or URL.
- Product upload/read/confirm first look up the product with the tenant scope; a depot A user gets 404 for a depot B product (tested).
- Confirm rejects keys whose prefix is not `depots/{callerDepotId}/{logo|products}/` (tested with a foreign-depot key).
- The real file type is checked from the object's leading bytes, not only the `Content-Type` header, and the key extension must match the detected type.
- The 2 MB limit is enforced on the stored object length, not only on the client.
- Only the object key is persisted; no public or presigned URL is stored.
- Replacing an image deletes the previous object and writes an audit entry.
- Presigned URLs expire after 5 minutes.
- R2 credentials are read from environment variables only, are never logged, and `.env.example` contains placeholders.
- Tests always use `MemoryStorageProvider` because `NODE_ENV=test`; no test can reach real R2.
- The migration adds columns to tables that already have table-level row-level security and reasserts `ENABLE ROW LEVEL SECURITY` for `depots` and `products`.

## Open issues / risks

- Real Cloudflare R2 was **not** tested: no credentials or bucket were provided. Only the in-memory fake was exercised. The S3 client, presigning, HEAD/range GET, and delete paths are implemented but unverified against the live service.
- Bucket CORS, the scoped API token, and the endpoint URL are documented in the README but were not verified against a real bucket.
- Deleting the previous object is best effort: if the R2 delete fails after the database update, an orphaned object can remain (the new key is already authoritative).
- There is no product form UI in the web app yet, so `ImageUpload` is wired into depot settings only. The component and API client already support `kind="product"` with a `productId`; wiring it into the product form is a small follow-up once that form exists.
- Per the task, product image read URLs are limited to OWNER and STOCK_KEEPER. SALES cannot request a read URL, so a future product list for sales will not show images unless that policy changes.
- The storage module returns action endpoints as HTTP 200 (`@HttpCode(200)`), overriding the default 201 for POST.

## Decisions needed from the human

- Provide R2 credentials and a test bucket if live verification is required before approval.
- Confirm whether SALES should be allowed to read product images (currently OWNER and STOCK_KEEPER only, as specified).
- Confirm when the product form UI will be built so the product image upload can be connected there.

## Human review (filled in by the human only)
Decision: approved
Notes:
