import type { UserRole } from '@/lib/types';

export type NavIconName =
  | 'dashboard'
  | 'products'
  | 'categories'
  | 'stock'
  | 'suppliers'
  | 'purchases'
  | 'invoices'
  | 'customers'
  | 'credit'
  | 'reports'
  | 'audit'
  | 'depots'
  | 'staff'
  | 'settings'
  | 'key';

export interface NavItem {
  href: string;
  labelKey: string;
  roles: readonly UserRole[];
  icon: NavIconName;
}

export const DEPOT_ROLES: readonly UserRole[] = ['OWNER', 'SALES', 'STOCK_KEEPER', 'DELIVERY'];

export const ALL_ROLES: readonly UserRole[] = ['PLATFORM_ADMIN', ...DEPOT_ROLES];

export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: '/dashboard',
    labelKey: 'nav.dashboard',
    roles: DEPOT_ROLES,
    icon: 'dashboard',
  },
  {
    href: '/products',
    labelKey: 'nav.products',
    roles: ['OWNER', 'SALES', 'STOCK_KEEPER'],
    icon: 'products',
  },
  {
    href: '/categories',
    labelKey: 'nav.categories',
    roles: ['OWNER', 'STOCK_KEEPER'],
    icon: 'categories',
  },
  {
    href: '/stock',
    labelKey: 'nav.stock',
    roles: ['OWNER', 'SALES', 'STOCK_KEEPER'],
    icon: 'stock',
  },
  {
    href: '/purchases',
    labelKey: 'nav.purchases',
    roles: ['OWNER', 'STOCK_KEEPER'],
    icon: 'purchases',
  },
  {
    href: '/suppliers',
    labelKey: 'nav.suppliers',
    roles: ['OWNER', 'STOCK_KEEPER'],
    icon: 'suppliers',
  },
  {
    href: '/invoices',
    labelKey: 'nav.invoices',
    roles: ['OWNER', 'SALES'],
    icon: 'invoices',
  },
  {
    href: '/customers',
    labelKey: 'nav.customers',
    roles: ['OWNER', 'SALES'],
    icon: 'customers',
  },
  {
    href: '/credit',
    labelKey: 'nav.credit',
    roles: ['OWNER', 'SALES'],
    icon: 'credit',
  },
  {
    href: '/reports',
    labelKey: 'nav.reports',
    roles: ['OWNER', 'SALES', 'STOCK_KEEPER'],
    icon: 'reports',
  },
  {
    href: '/audit-log',
    labelKey: 'nav.auditLog',
    roles: ['OWNER'],
    icon: 'audit',
  },
  {
    href: '/staff',
    labelKey: 'nav.staff',
    roles: ['OWNER'],
    icon: 'staff',
  },
  {
    href: '/settings',
    labelKey: 'nav.settings',
    roles: DEPOT_ROLES,
    icon: 'settings',
  },
  {
    href: '/platform/dashboard',
    labelKey: 'nav.platformDashboard',
    roles: ['PLATFORM_ADMIN'],
    icon: 'dashboard',
  },
  {
    href: '/platform/audit-log',
    labelKey: 'nav.platformAuditLog',
    roles: ['PLATFORM_ADMIN'],
    icon: 'audit',
  },
  {
    href: '/platform/depots',
    labelKey: 'nav.platformDepots',
    roles: ['PLATFORM_ADMIN'],
    icon: 'depots',
  },
  {
    href: '/change-password',
    labelKey: 'nav.changePassword',
    roles: ALL_ROLES,
    icon: 'key',
  },
];

export function visibleNavItems(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function defaultPathForRole(role: UserRole): string {
  return role === 'PLATFORM_ADMIN' ? '/platform/dashboard' : '/dashboard';
}

/**
 * Client-side route guard. The server still enforces every permission; this only keeps a user from
 * opening a page their role cannot use and landing on a mostly empty screen.
 */
export function canAccessPath(role: UserRole, pathname: string): boolean {
  const path = pathname.split(/[?#]/, 1)[0] ?? pathname;

  if (path === '/change-password' || path === '/forbidden') {
    return true;
  }

  if (role === 'PLATFORM_ADMIN') {
    return path.startsWith('/platform');
  }

  if (path.startsWith('/platform')) {
    return false;
  }

  if (path.startsWith('/staff')) {
    return role === 'OWNER';
  }

  if (path.startsWith('/audit-log')) {
    return role === 'OWNER';
  }

  if (path.startsWith('/categories')) {
    return role === 'OWNER' || role === 'STOCK_KEEPER';
  }

  if (path.startsWith('/stock')) {
    return role === 'OWNER' || role === 'SALES' || role === 'STOCK_KEEPER';
  }

  if (path.startsWith('/purchases') || path.startsWith('/suppliers')) {
    return role === 'OWNER' || role === 'STOCK_KEEPER';
  }

  if (path.startsWith('/invoices') || path.startsWith('/customers') || path.startsWith('/credit')) {
    return role === 'OWNER' || role === 'SALES';
  }

  if (path.startsWith('/reports')) {
    return role === 'OWNER' || role === 'SALES' || role === 'STOCK_KEEPER';
  }

  if (path.startsWith('/products')) {
    return role === 'OWNER' || role === 'SALES' || role === 'STOCK_KEEPER';
  }

  return true;
}
