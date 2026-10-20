-- SmartDepo row-level security: tenant isolation for every depot-owned table.
--
-- REFERENCE COPY, not executed directly. The applied source of truth is the Prisma migration
-- src/prisma/migrations/20261020075000_row_level_security/migration.sql; keep the two in sync.
--
-- How it works:
--   * The running API connects as smartdepo_app, which is NOT the table owner and has no BYPASSRLS,
--     so these policies always apply (the migration owner smartdepo_owner is not forced, so seed
--     and migration work still succeed).
--   * Every depot transaction calls set_config('app.depot_id', <uuid>, true); the platform-admin
--     path calls set_config('app.is_platform_admin', 'true', true) instead of a superuser role.
--   * current_setting('app.depot_id', true) returns NULL when unset, so row comparison yields NULL
--     and all rows are denied: RLS fails closed.
--   * This is defence in depth. The NestJS tenant extension in apps/api/src/common/tenant/ still
--     adds depot_id to every query on depot-owned models (AGENTS.md section 6.1).
--
-- Global tables: plans and roles hold reference data and have no RLS, but the app role has SELECT
-- only (see the 20261020100000_auth_and_depot_rls migration). The depots table has its own policy
-- below so a depot can see itself and the platform-admin path can see every depot.
--
-- Grants the app role needs (set up once by the database administrator, not in a migration because
-- role names are environment-specific):
--   GRANT USAGE ON SCHEMA public TO smartdepo_app;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO smartdepo_app;
--   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO smartdepo_app;
--   REVOKE INSERT, UPDATE, DELETE ON plans, roles FROM smartdepo_app;
--   GRANT SELECT ON plans, roles TO smartdepo_app;
-- and, so future migrations grant automatically:
--   ALTER DEFAULT PRIVILEGES FOR ROLE smartdepo_owner IN SCHEMA public
--     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO smartdepo_app;
--   ALTER DEFAULT PRIVILEGES FOR ROLE smartdepo_owner IN SCHEMA public
--     GRANT USAGE, SELECT ON SEQUENCES TO smartdepo_app;


ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "subscriptions"
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  );

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "users"
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  );

ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "categories"
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  );

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "products"
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  );

ALTER TABLE "product_units" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "product_units"
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  );

ALTER TABLE "prices" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "prices"
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  );

ALTER TABLE "batches" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "batches"
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  );

ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "stock_movements"
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  );

ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "customers"
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  );

ALTER TABLE "sales_orders" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "sales_orders"
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  );

ALTER TABLE "sale_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "sale_items"
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  );

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "payments"
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  );

ALTER TABLE "payment_allocations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "payment_allocations"
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  );

ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "suppliers"
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  );

ALTER TABLE "purchase_orders" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "purchase_orders"
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  );

ALTER TABLE "purchase_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "purchase_items"
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  );

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "audit_logs"
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "depot_id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  );

-- Audit logs are append-only (AGENTS.md 6.5): even the platform-admin path may not update or
-- delete them, only the table owner (migrations) can. These restrictive policies combine with the
-- tenant policy above, which still controls which rows are visible and insertable.
CREATE POLICY "audit_logs_no_update" ON "audit_logs" AS RESTRICTIVE FOR UPDATE USING (false);
CREATE POLICY "audit_logs_no_delete" ON "audit_logs" AS RESTRICTIVE FOR DELETE USING (false);

-- Added by the 20261020100000_auth_and_depot_rls migration. A depot can only see itself; the
-- platform-admin session sees every depot. Registration sets app.depot_id to the newly generated id
-- before inserting, so the WITH CHECK clause also covers the public registration path.
ALTER TABLE "depots" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "depot_tenant_isolation" ON "depots"
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR "id" = NULLIF(current_setting('app.depot_id', true), '')::uuid
  );
