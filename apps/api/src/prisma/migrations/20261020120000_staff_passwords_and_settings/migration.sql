-- Staff management, password lifecycle, and depot settings (FR-7, FR-8, FR-10).
--
-- This migration:
--   1. Replaces depots.rejection_reason with depots.status_reason so both rejection and suspension
--      store their reason in one column (the audit entry keeps a copy as well).
--   2. Adds users.must_change_password so an owner password reset forces a change at next login.
--   3. Ensures the depot settings columns exist (address, currency, locale, invoice footer).
--   4. Re-creates the two auth lookup functions with must_change_password in their result. The four
--      auth_* SECURITY DEFINER functions keep a pinned search_path: the two re-created here use
--      SET search_path = pg_catalog and the login bookkeeping functions already do the same. Running
--      `SELECT p.proname, p.proconfig FROM pg_proc ...` after this migration shows the pinned setting
--      on all four functions.

-- 1. Depot status reason ----------------------------------------------------

ALTER TABLE "depots" ADD COLUMN "status_reason" TEXT;

UPDATE "depots"
SET "status_reason" = "rejection_reason"
WHERE "rejection_reason" IS NOT NULL;

ALTER TABLE "depots" DROP COLUMN "rejection_reason";

-- 2. Password lifecycle -----------------------------------------------------

ALTER TABLE "users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;

-- 3. Depot settings columns (already present since the init migration) -------

ALTER TABLE "depots" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "depots" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3) NOT NULL DEFAULT 'KHR';
ALTER TABLE "depots" ADD COLUMN IF NOT EXISTS "locale" "Locale" NOT NULL DEFAULT 'EN';
ALTER TABLE "depots" ADD COLUMN IF NOT EXISTS "invoice_footer" TEXT;

-- 4. Auth lookup functions --------------------------------------------------
--
-- The return type changes (must_change_password is added), so the functions must be dropped and
-- re-created rather than replaced. The pinned search_path and the narrow grants are restored below.

DROP FUNCTION IF EXISTS public.auth_find_user(text);
DROP FUNCTION IF EXISTS public.auth_get_user(uuid);

CREATE FUNCTION public.auth_find_user(p_identifier text)
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
  depot_name text,
  must_change_password boolean
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
         d.name,
         u.must_change_password
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  LEFT JOIN public.depots d ON d.id = u.depot_id
  WHERE lower(u.email) = lower(p_identifier) OR u.phone = p_identifier
  LIMIT 1
$$;

CREATE FUNCTION public.auth_get_user(p_user_id uuid)
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
  depot_name text,
  must_change_password boolean
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
         d.name,
         u.must_change_password
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  LEFT JOIN public.depots d ON d.id = u.depot_id
  WHERE u.id = p_user_id
  LIMIT 1
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'smartdepo_app') THEN
    REVOKE ALL ON FUNCTION public.auth_find_user(text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.auth_get_user(uuid) FROM PUBLIC;

    GRANT EXECUTE ON FUNCTION public.auth_find_user(text) TO smartdepo_app;
    GRANT EXECUTE ON FUNCTION public.auth_get_user(uuid) TO smartdepo_app;
  END IF;
END $$;
