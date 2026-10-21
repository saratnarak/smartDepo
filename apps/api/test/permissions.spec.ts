import { Permission, ROLE_PERMISSIONS, roleHasPermission } from '../src/common/auth/permissions.js';

describe('role permissions', () => {
  it('lets OWNER do everything SALES and STOCK_KEEPER can do', () => {
    for (const permission of ROLE_PERMISSIONS.SALES) {
      expect(roleHasPermission('OWNER', permission)).toBe(true);
    }
    for (const permission of ROLE_PERMISSIONS.STOCK_KEEPER) {
      expect(roleHasPermission('OWNER', permission)).toBe(true);
    }
  });

  it('does not give depot roles platform-admin permissions', () => {
    expect(roleHasPermission('OWNER', Permission.PLATFORM_DEPOTS_MANAGE)).toBe(false);
    expect(roleHasPermission('SALES', Permission.PLATFORM_DEPOTS_READ)).toBe(false);
  });

  it('gives the platform admin only platform and self-service permissions', () => {
    expect(roleHasPermission('PLATFORM_ADMIN', Permission.PLATFORM_DEPOTS_MANAGE)).toBe(true);
    expect(roleHasPermission('PLATFORM_ADMIN', Permission.AUTH_ME)).toBe(true);
    expect(roleHasPermission('PLATFORM_ADMIN', Permission.DEPOT_MANAGE)).toBe(false);
  });

  it('grants every role access to its own profile', () => {
    for (const role of ['PLATFORM_ADMIN', 'OWNER', 'SALES', 'STOCK_KEEPER', 'DELIVERY'] as const) {
      expect(roleHasPermission(role, Permission.AUTH_ME)).toBe(true);
      expect(roleHasPermission(role, Permission.PASSWORD_CHANGE)).toBe(true);
    }
  });

  it('limits staff and settings management to the owner', () => {
    expect(roleHasPermission('OWNER', Permission.USERS_MANAGE)).toBe(true);
    expect(roleHasPermission('OWNER', Permission.DEPOT_MANAGE)).toBe(true);

    for (const role of ['PLATFORM_ADMIN', 'SALES', 'STOCK_KEEPER', 'DELIVERY'] as const) {
      expect(roleHasPermission(role, Permission.USERS_MANAGE)).toBe(false);
      expect(roleHasPermission(role, Permission.DEPOT_MANAGE)).toBe(false);
    }
  });

  it('lets stock keepers manage the catalog and lets sales read products only', () => {
    for (const permission of [
      Permission.CATEGORIES_READ,
      Permission.CATEGORIES_MANAGE,
      Permission.PRODUCTS_READ,
      Permission.PRODUCTS_MANAGE,
    ] as const) {
      expect(roleHasPermission('STOCK_KEEPER', permission)).toBe(true);
      expect(roleHasPermission('OWNER', permission)).toBe(true);
    }

    expect(roleHasPermission('SALES', Permission.PRODUCTS_READ)).toBe(true);
    expect(roleHasPermission('SALES', Permission.CATEGORIES_READ)).toBe(true);
    expect(roleHasPermission('SALES', Permission.PRODUCTS_MANAGE)).toBe(false);
    expect(roleHasPermission('SALES', Permission.CATEGORIES_MANAGE)).toBe(false);
    expect(roleHasPermission('DELIVERY', Permission.PRODUCTS_READ)).toBe(false);
  });

  it('lets stock keepers manage stock, suppliers, and purchases and lets sales read stock only', () => {
    for (const permission of [
      Permission.STOCK_READ,
      Permission.STOCK_MANAGE,
      Permission.SUPPLIERS_READ,
      Permission.SUPPLIERS_MANAGE,
      Permission.PURCHASES_READ,
      Permission.PURCHASES_MANAGE,
    ] as const) {
      expect(roleHasPermission('STOCK_KEEPER', permission)).toBe(true);
      expect(roleHasPermission('OWNER', permission)).toBe(true);
    }

    expect(roleHasPermission('SALES', Permission.STOCK_READ)).toBe(true);
    for (const permission of [
      Permission.STOCK_MANAGE,
      Permission.SUPPLIERS_READ,
      Permission.SUPPLIERS_MANAGE,
      Permission.PURCHASES_READ,
      Permission.PURCHASES_MANAGE,
    ] as const) {
      expect(roleHasPermission('SALES', permission)).toBe(false);
    }
    expect(roleHasPermission('DELIVERY', Permission.STOCK_READ)).toBe(false);
  });

  it('lets only the owner change prices', () => {
    expect(roleHasPermission('OWNER', Permission.PRICES_MANAGE)).toBe(true);

    for (const role of ['PLATFORM_ADMIN', 'SALES', 'STOCK_KEEPER', 'DELIVERY'] as const) {
      expect(roleHasPermission(role, Permission.PRICES_MANAGE)).toBe(false);
    }
  });

  it('keeps owner as a superset of stock keeper catalog permissions', () => {
    for (const permission of ROLE_PERMISSIONS.STOCK_KEEPER) {
      expect(roleHasPermission('OWNER', permission)).toBe(true);
    }
  });

  it('lets every depot role read depot settings', () => {
    for (const role of ['OWNER', 'SALES', 'STOCK_KEEPER', 'DELIVERY'] as const) {
      expect(roleHasPermission(role, Permission.DEPOT_READ)).toBe(true);
    }
    expect(roleHasPermission('PLATFORM_ADMIN', Permission.DEPOT_READ)).toBe(false);
  });
});
