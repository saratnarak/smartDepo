import type { DepotStatus, PrismaClient, RoleCode } from '../generated/prisma/client.js';

/**
 * Minimal user record needed for authentication. Returned by the SECURITY DEFINER functions in the
 * auth migration; passwordHash never leaves the auth service.
 */
export interface AuthUserRecord {
  id: string;
  depotId: string | null;
  roleCode: RoleCode;
  name: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  depotStatus: DepotStatus | null;
  depotName: string | null;
}

const AUTH_USER_COLUMNS = `
  id,
  depot_id AS "depotId",
  role_code AS "roleCode",
  name,
  email,
  phone,
  password_hash AS "passwordHash",
  is_active AS "isActive",
  failed_login_attempts AS "failedLoginAttempts",
  locked_until AS "lockedUntil",
  depot_status AS "depotStatus",
  depot_name AS "depotName"
`;

/**
 * Looks up a user by email (case-insensitive) or phone through the narrow auth function, because the
 * normal users RLS policy is scoped to one depot and login does not know the depot yet.
 */
export async function findAuthUser(
  client: PrismaClient,
  identifier: string,
): Promise<AuthUserRecord | null> {
  const rows = await client.$queryRawUnsafe<AuthUserRecord[]>(
    `SELECT ${AUTH_USER_COLUMNS} FROM public.auth_find_user($1)`,
    identifier,
  );
  return rows[0] ?? null;
}

export async function getAuthUser(
  client: PrismaClient,
  userId: string,
): Promise<AuthUserRecord | null> {
  const rows = await client.$queryRawUnsafe<AuthUserRecord[]>(
    `SELECT ${AUTH_USER_COLUMNS} FROM public.auth_get_user($1::uuid)`,
    userId,
  );
  return rows[0] ?? null;
}

export async function recordLoginSuccess(client: PrismaClient, userId: string): Promise<void> {
  // The function returns void; select a constant so Prisma never tries to deserialize a void column.
  await client.$queryRawUnsafe(
    'SELECT 1 AS ok FROM public.auth_record_login_success($1::uuid)',
    userId,
  );
}

export async function recordLoginFailure(
  client: PrismaClient,
  userId: string,
  maxAttempts: number,
  lockedUntil: Date,
): Promise<void> {
  await client.$queryRawUnsafe(
    'SELECT 1 AS ok FROM public.auth_record_login_failure($1::uuid, $2, $3)',
    userId,
    maxAttempts,
    lockedUntil,
  );
}
