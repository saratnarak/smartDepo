-- Platform auth, depot visibility, and reference-data hardening.
--
-- This migration:
--   1. Seeds the five role rows every environment needs (reference data).
--   2. Makes plans and roles read-only for the application role.
--   3. Adds tenant/platform row-level security to depots.
--   4. Adds SECURITY DEFINER auth functions so login can resolve a user by email or phone without
--      granting the application role a general cross-depot bypass. The functions return no rows for
--      unknown identifiers and are executable only by the application role.
--
-- The auth functions are owned by smartdepo_owner (the migration role), so they can read across
-- depots. They are intentionally narrow: they return one user row, login bookkeeping, and no lists.

INSERT INTO "roles" ("id", "code", "name") VALUES
  (gen_random_uuid(), 'PLATFORM_ADMIN', 'Platform Admin'),
  (gen_random_uuid(), 'OWNER', 'Owner'),
  (gen_random_uuid(), 'SALES', 'Sales'),
  (gen_random_uuid(), 'STOCK_KEEPER', 'Stock Keeper'),
  (gen_random_uuid(), 'DELIVERY', 'Delivery')
ON CONFLICT ("code") DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'smartdepo_app') THEN
    REVOKE INSERT, UPDATE, DELETE ON TABLE "plans" FROM smartdepo_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE "roles" FROM smartdepo_app;
    GRANT SELECT ON TABLE "plans", "roles" TO smartdepo_app;
  END IF;
END $$;

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

CREATE OR REPLACE FUNCTION public.auth_find_user(p_identifier text)
RETURNS TABLE (
  id uuid,
  depot_id uuid,
  role_code public."RoleCode",
  name text,
  email text,
  phone text,
  password_hash text,
  is_active boolean,
  failed_login_attempts integer,
  locked_until timestamp(3),
  depot_status public."DepotStatus",
  depot_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT u.id,
         u.depot_id,
         r.code,
         u.name,
         u.email,
         u.phone,
         u.password_hash,
         u.is_active,
         u.failed_login_attempts,
         u.locked_until,
         d.status,
         d.name
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  LEFT JOIN public.depots d ON d.id = u.depot_id
  WHERE lower(u.email) = lower(p_identifier) OR u.phone = p_identifier
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.auth_get_user(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  depot_id uuid,
  role_code public."RoleCode",
  name text,
  email text,
  phone text,
  password_hash text,
  is_active boolean,
  failed_login_attempts integer,
  locked_until timestamp(3),
  depot_status public."DepotStatus",
  depot_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT u.id,
         u.depot_id,
         r.code,
         u.name,
         u.email,
         u.phone,
         u.password_hash,
         u.is_active,
         u.failed_login_attempts,
         u.locked_until,
         d.status,
         d.name
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  LEFT JOIN public.depots d ON d.id = u.depot_id
  WHERE u.id = p_user_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.auth_record_login_success(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  UPDATE public.users
  SET last_login_at = now(),
      failed_login_attempts = 0,
      locked_until = NULL,
      updated_at = now()
  WHERE id = p_user_id
$$;

CREATE OR REPLACE FUNCTION public.auth_record_login_failure(
  p_user_id uuid,
  p_max_attempts integer,
  p_locked_until timestamp(3)
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  UPDATE public.users
  SET failed_login_attempts = failed_login_attempts + 1,
      locked_until = CASE
        WHEN failed_login_attempts + 1 >= p_max_attempts THEN p_locked_until
        ELSE locked_until
      END,
      updated_at = now()
  WHERE id = p_user_id
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'smartdepo_app') THEN
    REVOKE ALL ON FUNCTION public.auth_find_user(text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.auth_get_user(uuid) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.auth_record_login_success(uuid) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.auth_record_login_failure(uuid, integer, timestamp(3)) FROM PUBLIC;

    GRANT EXECUTE ON FUNCTION public.auth_find_user(text) TO smartdepo_app;
    GRANT EXECUTE ON FUNCTION public.auth_get_user(uuid) TO smartdepo_app;
    GRANT EXECUTE ON FUNCTION public.auth_record_login_success(uuid) TO smartdepo_app;
    GRANT EXECUTE ON FUNCTION public.auth_record_login_failure(uuid, integer, timestamp(3)) TO smartdepo_app;
  END IF;
END $$;
