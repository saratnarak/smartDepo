import type { UserRole } from '../tenant/tenant-context.js';

/**
 * Server-side permissions. Guards are default-deny: an endpoint without @RequirePermissions is
 * rejected even when the caller is authenticated. OWNER is a superset of SALES and STOCK_KEEPER, so
 * add new depot permissions to the SALES/STOCK_KEEPER sets and OWNER inherits them automatically.
 */
export const Permission = {
  AUTH_ME: 'auth.me',
  DEPOT_READ: 'depot.read',
  DEPOT_MANAGE: 'depot.manage',
  PLATFORM_DEPOTS_READ: 'platform.depots.read',
  PLATFORM_DEPOTS_MANAGE: 'platform.depots.manage',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

const SALES_PERMISSIONS: readonly Permission[] = [Permission.AUTH_ME, Permission.DEPOT_READ];
const STOCK_KEEPER_PERMISSIONS: readonly Permission[] = [Permission.AUTH_ME, Permission.DEPOT_READ];
const DELIVERY_PERMISSIONS: readonly Permission[] = [Permission.AUTH_ME, Permission.DEPOT_READ];

function permissionsFor(...groups: readonly (readonly Permission[])[]): ReadonlySet<Permission> {
  return new Set(groups.flat());
}

export const ROLE_PERMISSIONS: Readonly<Record<UserRole, ReadonlySet<Permission>>> = {
  PLATFORM_ADMIN: permissionsFor([
    Permission.AUTH_ME,
    Permission.PLATFORM_DEPOTS_READ,
    Permission.PLATFORM_DEPOTS_MANAGE,
  ]),
  OWNER: permissionsFor(SALES_PERMISSIONS, STOCK_KEEPER_PERMISSIONS, [Permission.DEPOT_MANAGE]),
  SALES: permissionsFor(SALES_PERMISSIONS),
  STOCK_KEEPER: permissionsFor(STOCK_KEEPER_PERMISSIONS),
  DELIVERY: permissionsFor(DELIVERY_PERMISSIONS),
};

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}
