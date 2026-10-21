-- Reports, dashboard, and the walk-in customer (FR-5, FR-42 to FR-49).
--
-- Every depot that is approved gets a default walk-in customer. The depots that were approved
-- before this task get one here; the unique partial index on (depot_id) WHERE is_walk_in makes
-- the insert safe to run again.
--
-- The new indexes keep the reports fast with about 50,000 invoice lines: the sales report
-- filters on the depot, the status, and the order date, and the staff report filters on the user
-- that wrote the invoice.

INSERT INTO "customers" (
  "id",
  "depot_id",
  "name",
  "type",
  "notes",
  "is_active",
  "is_walk_in",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  depot."id",
  'Walk-in',
  'RETAIL',
  'Default cash customer',
  true,
  true,
  now(),
  now()
FROM "depots" AS depot
WHERE depot."status" = 'APPROVED'
  AND NOT EXISTS (
    SELECT 1 FROM "customers" AS customer
    WHERE customer."depot_id" = depot."id" AND customer."is_walk_in" = true
  );

CREATE INDEX "sales_orders_depot_id_status_order_date_idx"
  ON "sales_orders"("depot_id", "status", "order_date");

CREATE INDEX "sales_orders_depot_id_created_by_id_idx"
  ON "sales_orders"("depot_id", "created_by_id");
