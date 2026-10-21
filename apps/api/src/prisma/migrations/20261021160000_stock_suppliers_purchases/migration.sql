-- Stock, suppliers, and purchases (FR-15, FR-17 to FR-22, FR-36 to FR-38).
--
-- Stock is still derived from stock_movements only. This migration adds the last purchase cost per
-- base unit on products, database checks that keep the ledger and money valid, indexes for stock
-- history and purchase listing, and idempotent row-level security guards for every affected table.

ALTER TABLE "products" ADD COLUMN "cost_price" DECIMAL(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "products"
  ADD CONSTRAINT "products_cost_price_nonnegative" CHECK ("cost_price" >= 0);

-- Append-only ledger checks. A manual adjustment or damage entry must always carry a reason.
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_quantity_nonzero" CHECK ("quantity" <> 0);
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_unit_cost_nonnegative"
  CHECK ("unit_cost" IS NULL OR "unit_cost" >= 0);
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_purchase_quantity_positive"
  CHECK ("type" <> 'PURCHASE' OR "quantity" > 0);
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_sale_quantity_negative"
  CHECK ("type" <> 'SALE' OR "quantity" < 0);
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_damage_quantity_negative"
  CHECK ("type" <> 'DAMAGE' OR "quantity" < 0);
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_reason_required"
  CHECK (
    "type" NOT IN ('ADJUSTMENT', 'DAMAGE')
    OR ("reason" IS NOT NULL AND btrim("reason") <> '')
  );

ALTER TABLE "suppliers"
  ADD CONSTRAINT "suppliers_name_not_blank" CHECK (btrim("name") <> '');

ALTER TABLE "batches"
  ADD CONSTRAINT "batches_number_not_blank" CHECK (btrim("batch_number") <> '');

ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_subtotal_nonnegative" CHECK ("subtotal" >= 0);
ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_discount_nonnegative" CHECK ("discount_total" >= 0);
ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_total_nonnegative" CHECK ("total" >= 0);

ALTER TABLE "purchase_items"
  ADD CONSTRAINT "purchase_items_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "purchase_items"
  ADD CONSTRAINT "purchase_items_quantity_base_positive" CHECK ("quantity_base" > 0);
ALTER TABLE "purchase_items"
  ADD CONSTRAINT "purchase_items_unit_cost_nonnegative" CHECK ("unit_cost" >= 0);
ALTER TABLE "purchase_items"
  ADD CONSTRAINT "purchase_items_line_total_nonnegative" CHECK ("line_total" >= 0);
ALTER TABLE "purchase_items"
  ADD CONSTRAINT "purchase_items_batch_number_not_blank"
  CHECK ("batch_number" IS NULL OR btrim("batch_number") <> '');

CREATE INDEX "stock_movements_depot_id_type_created_at_idx"
  ON "stock_movements"("depot_id", "type", "created_at");
CREATE INDEX "suppliers_depot_id_is_active_idx" ON "suppliers"("depot_id", "is_active");
CREATE INDEX "purchase_orders_depot_id_status_created_at_idx"
  ON "purchase_orders"("depot_id", "status", "created_at");

-- Row-level security. These tables already have tenant_isolation policies from the base RLS
-- migration; the DO blocks make the intent explicit and safely add a policy if one is ever missing.
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase_items" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'stock_movements',
    'batches',
    'suppliers',
    'purchase_orders',
    'purchase_items'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND policyname = 'tenant_isolation'
    ) THEN
      EXECUTE format(
        'CREATE POLICY "tenant_isolation" ON %I
           USING (
             current_setting(''app.is_platform_admin'', true) = ''true''
             OR "depot_id" = NULLIF(current_setting(''app.depot_id'', true), '''')::uuid
           )
           WITH CHECK (
             current_setting(''app.is_platform_admin'', true) = ''true''
             OR "depot_id" = NULLIF(current_setting(''app.depot_id'', true), '''')::uuid
           )',
        table_name
      );
    END IF;
  END LOOP;
END $$;
