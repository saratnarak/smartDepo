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
    }
  });
});
