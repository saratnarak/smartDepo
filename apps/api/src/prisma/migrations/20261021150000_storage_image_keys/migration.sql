-- File storage object keys (FR-10 depot logo, FR-8 product images).
--
-- Only the object key is stored; the client always fetches a short-lived presigned URL. No new table
-- is needed: depot and product rows are already covered by row-level security, and those policies are
-- table-level, so the new columns inherit them. The ENABLE statements below are idempotent reminders
-- that RLS applies to these tables.

ALTER TABLE "depots" ADD COLUMN "logo_key" TEXT;
ALTER TABLE "products" ADD COLUMN "image_key" TEXT;

ALTER TABLE "depots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
