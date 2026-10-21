import { canAccessPath, defaultPathForRole, visibleNavItems } from '@/lib/navigation';

function hrefs(role: Parameters<typeof visibleNavItems>[0]): string[] {
  return visibleNavItems(role).map((item) => item.href);
}

describe('role-based navigation', () => {
  it('shows the owner the catalog, stock, purchases, staff, and settings pages', () => {
    expect(hrefs('OWNER')).toEqual([
      '/dashboard',
      '/products',
      '/categories',
      '/stock',
      '/purchases',
      '/suppliers',
      '/invoices',
      '/customers',
      '/credit',
      '/reports',
      '/audit-log',
      '/staff',
      '/settings',
      '/change-password',
    ]);
  });

  it('hides staff management from non-owner depot roles', () => {
    expect(hrefs('SALES')).toEqual([
      '/dashboard',
      '/products',
      '/stock',
      '/invoices',
      '/customers',
      '/credit',
      '/reports',
      '/settings',
      '/change-password',
    ]);
    expect(hrefs('STOCK_KEEPER')).toEqual([
      '/dashboard',
      '/products',
      '/categories',
      '/stock',
      '/purchases',
      '/suppliers',
      '/reports',
      '/settings',
      '/change-password',
    ]);
    expect(hrefs('SALES')).not.toContain('/staff');
    expect(hrefs('STOCK_KEEPER')).not.toContain('/staff');
    expect(hrefs('DELIVERY')).not.toContain('/staff');
    expect(hrefs('DELIVERY')).not.toContain('/products');
    expect(hrefs('DELIVERY')).not.toContain('/categories');
  });

  it('gives sales the invoice, customer, and credit screens but not the stock keeper', () => {
    expect(hrefs('SALES')).toEqual(expect.arrayContaining(['/invoices', '/customers', '/credit']));
    expect(hrefs('STOCK_KEEPER')).not.toContain('/invoices');
    expect(hrefs('STOCK_KEEPER')).not.toContain('/customers');
    expect(hrefs('STOCK_KEEPER')).not.toContain('/credit');
    expect(hrefs('DELIVERY')).not.toContain('/invoices');
    expect(hrefs('DELIVERY')).not.toContain('/customers');
    expect(hrefs('DELIVERY')).not.toContain('/credit');
  });

  it('gives sales read-only stock access and hides suppliers and purchases', () => {
    expect(hrefs('SALES')).toContain('/stock');
    expect(hrefs('SALES')).not.toContain('/purchases');
    expect(hrefs('SALES')).not.toContain('/suppliers');
    expect(hrefs('DELIVERY')).not.toContain('/stock');
    expect(hrefs('DELIVERY')).not.toContain('/purchases');
    expect(hrefs('DELIVERY')).not.toContain('/suppliers');
  });

  it('shows the platform admin the platform dashboard, the platform log, the depot review, and the password page', () => {
    expect(hrefs('PLATFORM_ADMIN')).toEqual([
      '/platform/dashboard',
      '/platform/audit-log',
      '/platform/depots',
      '/change-password',
    ]);
  });

  it('gives the audit log to the owner only', () => {
    expect(hrefs('OWNER')).toContain('/audit-log');
    expect(hrefs('SALES')).not.toContain('/audit-log');
    expect(hrefs('STOCK_KEEPER')).not.toContain('/audit-log');
    expect(hrefs('DELIVERY')).not.toContain('/audit-log');
    expect(hrefs('PLATFORM_ADMIN')).not.toContain('/audit-log');
    expect(hrefs('PLATFORM_ADMIN')).toContain('/platform/audit-log');
  });

  it('gives the reports to the roles that may read a report', () => {
    expect(hrefs('OWNER')).toContain('/reports');
    expect(hrefs('SALES')).toContain('/reports');
    expect(hrefs('STOCK_KEEPER')).toContain('/reports');
    expect(hrefs('DELIVERY')).not.toContain('/reports');
    expect(hrefs('PLATFORM_ADMIN')).not.toContain('/reports');
  });

  it('guards restricted routes for every role', () => {
    expect(canAccessPath('OWNER', '/staff')).toBe(true);
    expect(canAccessPath('SALES', '/staff')).toBe(false);
    expect(canAccessPath('SALES', '/settings')).toBe(true);
    expect(canAccessPath('OWNER', '/platform/depots')).toBe(false);
    expect(canAccessPath('PLATFORM_ADMIN', '/platform/depots')).toBe(true);
    expect(canAccessPath('PLATFORM_ADMIN', '/dashboard')).toBe(false);
    expect(canAccessPath('PLATFORM_ADMIN', '/change-password')).toBe(true);
    expect(canAccessPath('SALES', '/change-password')).toBe(true);
    expect(canAccessPath('SALES', '/forbidden')).toBe(true);
    expect(canAccessPath('OWNER', '/products')).toBe(true);
    expect(canAccessPath('STOCK_KEEPER', '/products')).toBe(true);
    expect(canAccessPath('SALES', '/products')).toBe(true);
    expect(canAccessPath('DELIVERY', '/products')).toBe(false);
    expect(canAccessPath('OWNER', '/categories')).toBe(true);
    expect(canAccessPath('STOCK_KEEPER', '/categories')).toBe(true);
    expect(canAccessPath('SALES', '/categories')).toBe(false);
    expect(canAccessPath('DELIVERY', '/categories')).toBe(false);
    expect(canAccessPath('OWNER', '/invoices')).toBe(true);
    expect(canAccessPath('SALES', '/invoices')).toBe(true);
    expect(canAccessPath('STOCK_KEEPER', '/invoices')).toBe(false);
    expect(canAccessPath('DELIVERY', '/invoices')).toBe(false);
    expect(canAccessPath('OWNER', '/invoices/new')).toBe(true);
    expect(canAccessPath('SALES', '/invoices/new')).toBe(true);
    expect(canAccessPath('STOCK_KEEPER', '/invoices/new')).toBe(false);
    expect(canAccessPath('OWNER', '/customers')).toBe(true);
    expect(canAccessPath('SALES', '/customers')).toBe(true);
    expect(canAccessPath('STOCK_KEEPER', '/customers')).toBe(false);
    expect(canAccessPath('OWNER', '/customers/abc')).toBe(true);
    expect(canAccessPath('SALES', '/customers/abc')).toBe(true);
    expect(canAccessPath('DELIVERY', '/customers/abc')).toBe(false);
    expect(canAccessPath('OWNER', '/credit')).toBe(true);
    expect(canAccessPath('SALES', '/credit')).toBe(true);
    expect(canAccessPath('STOCK_KEEPER', '/credit')).toBe(false);
    expect(canAccessPath('DELIVERY', '/credit')).toBe(false);
    expect(canAccessPath('OWNER', '/stock')).toBe(true);
    expect(canAccessPath('STOCK_KEEPER', '/stock')).toBe(true);
    expect(canAccessPath('SALES', '/stock')).toBe(true);
    expect(canAccessPath('DELIVERY', '/stock')).toBe(false);
    expect(canAccessPath('OWNER', '/purchases')).toBe(true);
    expect(canAccessPath('STOCK_KEEPER', '/purchases')).toBe(true);
    expect(canAccessPath('SALES', '/purchases')).toBe(false);
    expect(canAccessPath('DELIVERY', '/purchases')).toBe(false);
    expect(canAccessPath('OWNER', '/suppliers')).toBe(true);
    expect(canAccessPath('STOCK_KEEPER', '/suppliers')).toBe(true);
    expect(canAccessPath('SALES', '/suppliers')).toBe(false);
    expect(canAccessPath('DELIVERY', '/suppliers')).toBe(false);
    expect(canAccessPath('OWNER', '/audit-log')).toBe(true);
    expect(canAccessPath('SALES', '/audit-log')).toBe(false);
    expect(canAccessPath('STOCK_KEEPER', '/audit-log')).toBe(false);
    expect(canAccessPath('DELIVERY', '/audit-log')).toBe(false);
    expect(canAccessPath('PLATFORM_ADMIN', '/audit-log')).toBe(false);
    expect(canAccessPath('PLATFORM_ADMIN', '/platform/audit-log')).toBe(true);
    expect(canAccessPath('OWNER', '/reports')).toBe(true);
    expect(canAccessPath('SALES', '/reports')).toBe(true);
    expect(canAccessPath('STOCK_KEEPER', '/reports')).toBe(true);
    expect(canAccessPath('DELIVERY', '/reports')).toBe(false);
    expect(canAccessPath('OWNER', '/reports/sales')).toBe(true);
    expect(canAccessPath('SALES', '/reports/credit')).toBe(true);
    expect(canAccessPath('STOCK_KEEPER', '/reports/inventory')).toBe(true);
    expect(canAccessPath('DELIVERY', '/reports/inventory')).toBe(false);
    expect(canAccessPath('OWNER', '/platform/dashboard')).toBe(false);
    expect(canAccessPath('PLATFORM_ADMIN', '/platform/dashboard')).toBe(true);
  });

  it('sends each role to its own home page', () => {
    expect(defaultPathForRole('PLATFORM_ADMIN')).toBe('/platform/dashboard');
    expect(defaultPathForRole('OWNER')).toBe('/dashboard');
    expect(defaultPathForRole('DELIVERY')).toBe('/dashboard');
  });
});
