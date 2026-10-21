import type { UserRole } from '../tenant/tenant-context.js';

/**
 * Server-side permissions. Guards are default-deny: an endpoint without @RequirePermissions is
 * rejected even when the caller is authenticated. OWNER is a superset of SALES and STOCK_KEEPER, so
 * add new depot permissions to the SALES/STOCK_KEEPER sets and OWNER inherits them automatically.
 */
export const Permission = {
  AUTH_ME: 'auth.me',
  PASSWORD_CHANGE: 'auth.password.change',
  DEPOT_READ: 'depot.read',
  DEPOT_MANAGE: 'depot.manage',
  USERS_MANAGE: 'users.manage',
  CATEGORIES_READ: 'categories.read',
  CATEGORIES_MANAGE: 'categories.manage',
  PRODUCTS_READ: 'products.read',
  PRODUCTS_MANAGE: 'products.manage',
  PRICES_MANAGE: 'prices.manage',
  STOCK_READ: 'stock.read',
  STOCK_MANAGE: 'stock.manage',
  SUPPLIERS_READ: 'suppliers.read',
  SUPPLIERS_MANAGE: 'suppliers.manage',
  PURCHASES_READ: 'purchases.read',
  PURCHASES_MANAGE: 'purchases.manage',
  CUSTOMERS_READ: 'customers.read',
  CUSTOMERS_MANAGE: 'customers.manage',
  INVOICES_READ: 'invoices.read',
  INVOICES_CREATE: 'invoices.create',
  INVOICES_VOID: 'invoices.void',
  INVOICES_PRICE_OVERRIDE: 'invoices.price.override',
  PAYMENTS_READ: 'payments.read',
  PAYMENTS_RECORD: 'payments.record',
  CREDIT_READ: 'credit.read',
  CREDIT_SETTINGS_MANAGE: 'credit.settings.manage',
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
  STORAGE_LOGO_MANAGE: 'storage.logo.manage',
  STORAGE_PRODUCT_IMAGE_MANAGE: 'storage.product.image.manage',
  PLATFORM_DEPOTS_READ: 'platform.depots.read',
  PLATFORM_DEPOTS_MANAGE: 'platform.depots.manage',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

const SELF_SERVICE_PERMISSIONS: readonly Permission[] = [
  Permission.AUTH_ME,
  Permission.PASSWORD_CHANGE,
];
const SALES_PERMISSIONS: readonly Permission[] = [
  ...SELF_SERVICE_PERMISSIONS,
  Permission.DEPOT_READ,
  Permission.CATEGORIES_READ,
  Permission.PRODUCTS_READ,
  Permission.STOCK_READ,
  Permission.CUSTOMERS_READ,
  Permission.CUSTOMERS_MANAGE,
  Permission.INVOICES_READ,
  Permission.INVOICES_CREATE,
  Permission.PAYMENTS_READ,
  Permission.PAYMENTS_RECORD,
  Permission.CREDIT_READ,
  Permission.REPORTS_SALES,
  Permission.DASHBOARD_VIEW,
];
const STOCK_KEEPER_PERMISSIONS: readonly Permission[] = [
  ...SELF_SERVICE_PERMISSIONS,
  Permission.DEPOT_READ,
  Permission.CATEGORIES_READ,
  Permission.CATEGORIES_MANAGE,
  Permission.PRODUCTS_READ,
  Permission.PRODUCTS_MANAGE,
  Permission.STOCK_READ,
  Permission.STOCK_MANAGE,
  Permission.SUPPLIERS_READ,
  Permission.SUPPLIERS_MANAGE,
  Permission.PURCHASES_READ,
  Permission.PURCHASES_MANAGE,
  Permission.REPORTS_INVENTORY,
  Permission.REPORTS_PURCHASES,
  Permission.DASHBOARD_VIEW,
  Permission.STORAGE_PRODUCT_IMAGE_MANAGE,
];
const DELIVERY_PERMISSIONS: readonly Permission[] = [
  ...SELF_SERVICE_PERMISSIONS,
  Permission.DEPOT_READ,
];

function permissionsFor(...groups: readonly (readonly Permission[])[]): ReadonlySet<Permission> {
  return new Set(groups.flat());
}

export const ROLE_PERMISSIONS: Readonly<Record<UserRole, ReadonlySet<Permission>>> = {
  PLATFORM_ADMIN: permissionsFor(SELF_SERVICE_PERMISSIONS, [
    Permission.PLATFORM_DEPOTS_READ,
    Permission.PLATFORM_DEPOTS_MANAGE,
    Permission.PLATFORM_DASHBOARD_VIEW,
    Permission.PLATFORM_PLANS_READ,
    Permission.PLATFORM_PLANS_MANAGE,
    Permission.PLATFORM_AUDIT_LOG_READ,
  ]),
  OWNER: permissionsFor(SALES_PERMISSIONS, STOCK_KEEPER_PERMISSIONS, [
    Permission.DEPOT_MANAGE,
    Permission.USERS_MANAGE,
    Permission.PRICES_MANAGE,
    Permission.STORAGE_LOGO_MANAGE,
    Permission.INVOICES_VOID,
    Permission.INVOICES_PRICE_OVERRIDE,
    Permission.CREDIT_SETTINGS_MANAGE,
    Permission.REPORTS_FULL,
    Permission.PLAN_READ,
    Permission.AUDIT_LOG_READ,
  ]),
  SALES: permissionsFor(SALES_PERMISSIONS),
  STOCK_KEEPER: permissionsFor(STOCK_KEEPER_PERMISSIONS),
  DELIVERY: permissionsFor(DELIVERY_PERMISSIONS),
};

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}
