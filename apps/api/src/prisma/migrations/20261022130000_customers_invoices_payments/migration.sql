-- Customers, invoices, payments, and credit (FR-23 to FR-35).
--
-- Adds the customer type used to pick the retail or wholesale price, the invoice payment state,
-- the invoice discount fields, the idempotency key that makes a retried create safe, the batch
-- allocation of every sold line, and the depot credit-limit mode. Amounts and quantities keep their
-- database checks, and every new or changed table keeps its row-level security policy.

-- Enums -------------------------------------------------------------------

-- The customer type decides which price list an invoice uses, so the old business categories
-- (RETAILER, RESTAURANT, OTHER) are replaced by the two price types.
ALTER TYPE "CustomerType" RENAME TO "CustomerType_old";
CREATE TYPE "CustomerType" AS ENUM ('RETAIL', 'WHOLESALE');
ALTER TABLE "customers" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "customers"
  ALTER COLUMN "type" TYPE "CustomerType" USING "type"::text::"CustomerType";
ALTER TABLE "customers" ALTER COLUMN "type" SET DEFAULT 'RETAIL';
DROP TYPE "CustomerType_old";

CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'PARTIAL', 'UNPAID');
CREATE TYPE "DiscountType" AS ENUM ('AMOUNT', 'PERCENT');
CREATE TYPE "CreditLimitMode" AS ENUM ('WARN', 'BLOCK');

-- Depots ------------------------------------------------------------------

ALTER TABLE "depots"
  ADD COLUMN "credit_limit_mode" "CreditLimitMode" NOT NULL DEFAULT 'WARN';

-- Customers ---------------------------------------------------------------

ALTER TABLE "customers" ADD COLUMN "is_walk_in" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "customers_depot_id_is_active_idx" ON "customers"("depot_id", "is_active");
CREATE UNIQUE INDEX "customers_one_walk_in_per_depot_key"
  ON "customers"("depot_id") WHERE "is_walk_in" = true;

ALTER TABLE "customers"
  ADD CONSTRAINT "customers_name_not_blank" CHECK (btrim("name") <> '');
ALTER TABLE "customers"
  ADD CONSTRAINT "customers_credit_limit_nonnegative"
  CHECK ("credit_limit" IS NULL OR "credit_limit" >= 0);
ALTER TABLE "customers"
  ADD CONSTRAINT "customers_payment_term_days_nonnegative"
  CHECK ("payment_term_days" IS NULL OR "payment_term_days" >= 0);

-- Sales orders ------------------------------------------------------------

ALTER TABLE "sales_orders"
  ADD COLUMN "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';
ALTER TABLE "sales_orders"
  ADD COLUMN "discount_type" "DiscountType";
ALTER TABLE "sales_orders"
  ADD COLUMN "discount_value" DECIMAL(18, 4);
ALTER TABLE "sales_orders"
  ADD COLUMN "refund_due" DECIMAL(14, 2) NOT NULL DEFAULT 0;
ALTER TABLE "sales_orders"
  ADD COLUMN "idempotency_key" TEXT;

CREATE INDEX "sales_orders_depot_id_payment_status_idx" ON "sales_orders"("depot_id", "payment_status");
CREATE INDEX "sales_orders_depot_id_due_date_idx" ON "sales_orders"("depot_id", "due_date");
CREATE UNIQUE INDEX "sales_orders_depot_id_idempotency_key_key"
  ON "sales_orders"("depot_id", "idempotency_key");

ALTER TABLE "sales_orders"
  ADD CONSTRAINT "sales_orders_subtotal_nonnegative" CHECK ("subtotal" >= 0);
ALTER TABLE "sales_orders"
  ADD CONSTRAINT "sales_orders_discount_total_nonnegative" CHECK ("discount_total" >= 0);
ALTER TABLE "sales_orders"
  ADD CONSTRAINT "sales_orders_total_nonnegative" CHECK ("total" >= 0);
ALTER TABLE "sales_orders"
  ADD CONSTRAINT "sales_orders_refund_due_nonnegative" CHECK ("refund_due" >= 0);
ALTER TABLE "sales_orders"
  ADD CONSTRAINT "sales_orders_discount_value_nonnegative"
  CHECK ("discount_value" IS NULL OR "discount_value" >= 0);
ALTER TABLE "sales_orders"
  ADD CONSTRAINT "sales_orders_void_needs_reason"
  CHECK ("status" <> 'VOIDED' OR ("void_reason" IS NOT NULL AND btrim("void_reason") <> ''));

-- Sale items --------------------------------------------------------------

ALTER TABLE "sale_items"
  ADD COLUMN "discount_type" "DiscountType";
ALTER TABLE "sale_items"
  ADD COLUMN "discount_value" DECIMAL(18, 4);

ALTER TABLE "sale_items"
  ADD CONSTRAINT "sale_items_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "sale_items"
  ADD CONSTRAINT "sale_items_quantity_base_positive" CHECK ("quantity_base" > 0);
ALTER TABLE "sale_items"
  ADD CONSTRAINT "sale_items_unit_price_nonnegative" CHECK ("unit_price" >= 0);
ALTER TABLE "sale_items"
  ADD CONSTRAINT "sale_items_discount_amount_nonnegative" CHECK ("discount_amount" >= 0);
ALTER TABLE "sale_items"
  ADD CONSTRAINT "sale_items_discount_value_nonnegative"
  CHECK ("discount_value" IS NULL OR "discount_value" >= 0);
ALTER TABLE "sale_items"
  ADD CONSTRAINT "sale_items_line_total_nonnegative" CHECK ("line_total" >= 0);
ALTER TABLE "sale_items"
  ADD CONSTRAINT "sale_items_cost_per_base_unit_nonnegative"
  CHECK ("cost_per_base_unit" IS NULL OR "cost_per_base_unit" >= 0);

-- Sale item batches -------------------------------------------------------

CREATE TABLE "sale_item_batches" (
  "id" UUID NOT NULL,
  "depot_id" UUID NOT NULL,
  "sale_item_id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "quantity" DECIMAL(18, 3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sale_item_batches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sale_item_batches_quantity_positive" CHECK ("quantity" > 0)
);

CREATE UNIQUE INDEX "sale_item_batches_sale_item_id_batch_id_key"
  ON "sale_item_batches"("sale_item_id", "batch_id");
CREATE INDEX "sale_item_batches_depot_id_idx" ON "sale_item_batches"("depot_id");
CREATE INDEX "sale_item_batches_depot_id_batch_id_idx" ON "sale_item_batches"("depot_id", "batch_id");

ALTER TABLE "sale_item_batches"
  ADD CONSTRAINT "sale_item_batches_depot_id_fkey"
  FOREIGN KEY ("depot_id") REFERENCES "depots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_item_batches"
  ADD CONSTRAINT "sale_item_batches_sale_item_id_fkey"
  FOREIGN KEY ("sale_item_id") REFERENCES "sale_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sale_item_batches"
  ADD CONSTRAINT "sale_item_batches_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Payments ----------------------------------------------------------------
--
-- The positive amount checks for payments and payment allocations already exist from the initial
-- migration, so they are not repeated here.

-- Row-level security ------------------------------------------------------

ALTER TABLE "sale_item_batches" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "sale_item_batches"
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  );

-- The customer, invoice, payment, and allocation tables already carry the tenant policy from the
-- base RLS migration; the statement below keeps that guarantee explicit and idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customers'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON "customers"
      USING (
        current_setting('app.is_platform_admin', true) = 'true'
        OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
      )
      WITH CHECK (
        current_setting('app.is_platform_admin', true) = 'true'
        OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
      );
  END IF;
END $$;
