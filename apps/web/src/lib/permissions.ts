import type { UserRole } from '@/lib/types';

/**
 * The frontend mirror of the permission map of the API (`apps/api/src/common/auth/permissions.ts`).
 * The server stays the real guard: these permissions only decide what the navigation shows and
 * which report tabs are rendered, so a user never opens a screen that the API would refuse.
 */
export const PERMISSIONS = {
  REPORTS_SALES: 'reports.sales',
  REPORTS_FULL: 'reports.full',
  REPORTS_INVENTORY: 'reports.inventory',
  REPORTS_PURCHASES: 'reports.purchases',
  DASHBOARD_VIEW: 'dashboard.view',
  PLATFORM_DASHBOARD_VIEW: 'platform.dashboard.view',
  PLAN_READ: 'plan.read',
  PLATFORM_PLANS_READ: 'platform.plans.read',
  PLATFORM_PLANS_MANAGE: 'platform.plans.manage',
  AUDIT_LOG_READ: 'audit.log.read',
  PLATFORM_AUDIT_LOG_READ: 'platform.audit.log.read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  PLATFORM_ADMIN: [
    PERMISSIONS.PLATFORM_DASHBOARD_VIEW,
    PERMISSIONS.PLATFORM_PLANS_READ,
    PERMISSIONS.PLATFORM_PLANS_MANAGE,
    PERMISSIONS.PLATFORM_AUDIT_LOG_READ,
  ],
  OWNER: [
    PERMISSIONS.REPORTS_SALES,
    PERMISSIONS.REPORTS_FULL,
    PERMISSIONS.REPORTS_INVENTORY,
    PERMISSIONS.REPORTS_PURCHASES,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PLAN_READ,
    PERMISSIONS.AUDIT_LOG_READ,
  ],
  SALES: [PERMISSIONS.REPORTS_SALES, PERMISSIONS.DASHBOARD_VIEW],
  STOCK_KEEPER: [
    PERMISSIONS.REPORTS_INVENTORY,
    PERMISSIONS.REPORTS_PURCHASES,
    PERMISSIONS.DASHBOARD_VIEW,
  ],
  DELIVERY: [],
};

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
