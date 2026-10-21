-- Categories, products, units, and prices (FR-11, FR-12, FR-13, FR-16).
--
-- Adds the immutable price history table, search/filter indexes, and database checks that keep
-- quantities and money valid. Stock is still derived from stock_movements only; no stock column is
-- introduced here.

-- Catalog indexes -----------------------------------------------------------

CREATE INDEX "categories_depot_id_is_active_idx" ON "categories"("depot_id", "is_active");

CREATE INDEX "products_depot_id_is_active_idx" ON "products"("depot_id", "is_active");
CREATE INDEX "products_depot_id_is_active_name_idx" ON "products"("depot_id", "is_active", "name");

CREATE INDEX "product_units_depot_id_product_id_is_active_idx"
  ON "product_units"("depot_id", "product_id", "is_active");

-- At most one base unit per product, and no second unit can also use factor 1. The service still
-- enforces "exactly one" on create; these indexes close the concurrent/direct-write gap.
CREATE UNIQUE INDEX "product_units_one_base_per_product_key"
  ON "product_units"("product_id") WHERE "is_base_unit" = true;
CREATE UNIQUE INDEX "product_units_one_factor_one_per_product_key"
  ON "product_units"("product_id") WHERE "conversion_factor" = 1;

-- Catalog checks ------------------------------------------------------------

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_name_not_blank" CHECK (btrim("name") <> '');

ALTER TABLE "products"
  ADD CONSTRAINT "products_name_not_blank" CHECK (btrim("name") <> '');
ALTER TABLE "products"
  ADD CONSTRAINT "products_sku_not_blank" CHECK (btrim("sku") <> '');
ALTER TABLE "products"
  ADD CONSTRAINT "products_reorder_level_nonnegative" CHECK ("reorder_level" >= 0);

ALTER TABLE "product_units"
  ADD CONSTRAINT "product_units_name_not_blank" CHECK (btrim("name") <> '');
ALTER TABLE "product_units"
  ADD CONSTRAINT "product_units_conversion_factor_positive" CHECK ("conversion_factor" > 0);
ALTER TABLE "product_units"
  ADD CONSTRAINT "product_units_base_factor_one"
  CHECK (NOT "is_base_unit" OR "conversion_factor" = 1);

ALTER TABLE "prices"
  ADD CONSTRAINT "prices_amount_nonnegative" CHECK ("amount" >= 0);

-- Price history -------------------------------------------------------------

CREATE TABLE "price_history" (
    "id" UUID NOT NULL,
    "depot_id" UUID NOT NULL,
    "price_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_unit_id" UUID NOT NULL,
    "type" "PriceType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "changed_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "price_history"
  ADD CONSTRAINT "price_history_depot_id_fkey"
  FOREIGN KEY ("depot_id") REFERENCES "depots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "price_history"
  ADD CONSTRAINT "price_history_price_id_fkey"
  FOREIGN KEY ("price_id") REFERENCES "prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "price_history"
  ADD CONSTRAINT "price_history_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "price_history"
  ADD CONSTRAINT "price_history_product_unit_id_fkey"
  FOREIGN KEY ("product_unit_id") REFERENCES "product_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "price_history"
  ADD CONSTRAINT "price_history_changed_by_id_fkey"
  FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "price_history"
  ADD CONSTRAINT "price_history_amount_nonnegative" CHECK ("amount" >= 0);

CREATE INDEX "price_history_depot_id_idx" ON "price_history"("depot_id");
CREATE INDEX "price_history_depot_id_product_unit_id_created_at_idx"
  ON "price_history"("depot_id", "product_unit_id", "created_at");
CREATE INDEX "price_history_depot_id_product_id_created_at_idx"
  ON "price_history"("depot_id", "product_id", "created_at");
CREATE INDEX "price_history_price_id_idx" ON "price_history"("price_id");
CREATE INDEX "price_history_changed_by_id_idx" ON "price_history"("changed_by_id");

-- Row-level security for the new depot-owned table --------------------------

ALTER TABLE "price_history" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "price_history"
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  );

-- The application role needs access to the new table even where default privileges do not apply.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'smartdepo_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.price_history TO smartdepo_app;
  END IF;
END $$;
