import { PERMISSIONS, roleHasPermission, type Permission } from '@/lib/permissions';
import type { UserRole } from '@/lib/types';

/**
 * The reports of the depot (FR-42 to FR-48). Every entry knows the permission it needs, so the
 * navigation, the report index, and the tabs of a report follow the same map as the API.
 */
export const SALES_VIEWS = ['period', 'product', 'category', 'customer', 'staff'] as const;

export type SalesView = (typeof SALES_VIEWS)[number];

export interface ReportDefinition {
  key: string;
  /** The link of the report. */
  href: string;
  labelKey: string;
  descriptionKey: string;
  permission: Permission;
  /** The name of the CSV file that the download button uses. */
  csvFileName: string;
  /** The endpoint of the API that the report reads. */
  apiPath: string;
}

export const REPORTS: readonly ReportDefinition[] = [
  {
    key: 'sales',
    href: '/reports/sales',
    labelKey: 'reports.report.sales',
    descriptionKey: 'reports.report.salesBody',
    permission: PERMISSIONS.REPORTS_SALES,
    csvFileName: 'sales.csv',
    apiPath: '/reports/sales',
  },
  {
    key: 'salesByProduct',
    href: '/reports/sales?view=product',
    labelKey: 'reports.report.salesByProduct',
    descriptionKey: 'reports.report.salesByProductBody',
    permission: PERMISSIONS.REPORTS_FULL,
    csvFileName: 'sales-by-product.csv',
    apiPath: '/reports/sales/by-product',
  },
  {
    key: 'salesByCategory',
    href: '/reports/sales?view=category',
    labelKey: 'reports.report.salesByCategory',
    descriptionKey: 'reports.report.salesByCategoryBody',
    permission: PERMISSIONS.REPORTS_FULL,
    csvFileName: 'sales-by-category.csv',
    apiPath: '/reports/sales/by-category',
  },
  {
    key: 'salesByCustomer',
    href: '/reports/sales?view=customer',
    labelKey: 'reports.report.salesByCustomer',
    descriptionKey: 'reports.report.salesByCustomerBody',
    permission: PERMISSIONS.REPORTS_FULL,
    csvFileName: 'sales-by-customer.csv',
    apiPath: '/reports/sales/by-customer',
  },
  {
    key: 'salesByStaff',
    href: '/reports/sales?view=staff',
    labelKey: 'reports.report.salesByStaff',
    descriptionKey: 'reports.report.salesByStaffBody',
    permission: PERMISSIONS.REPORTS_FULL,
    csvFileName: 'sales-by-staff.csv',
    apiPath: '/reports/sales/by-staff',
  },
  {
    key: 'inventory',
    href: '/reports/inventory',
    labelKey: 'reports.report.inventory',
    descriptionKey: 'reports.report.inventoryBody',
    permission: PERMISSIONS.REPORTS_INVENTORY,
    csvFileName: 'inventory.csv',
    apiPath: '/reports/inventory',
  },
  {
    key: 'credit',
    href: '/reports/credit',
    labelKey: 'reports.report.credit',
    descriptionKey: 'reports.report.creditBody',
    permission: PERMISSIONS.REPORTS_FULL,
    csvFileName: 'credit.csv',
    apiPath: '/reports/credit',
  },
  {
    key: 'profit',
    href: '/reports/profit',
    labelKey: 'reports.report.profit',
    descriptionKey: 'reports.report.profitBody',
    permission: PERMISSIONS.REPORTS_FULL,
    csvFileName: 'profit.csv',
    apiPath: '/reports/profit',
  },
  {
    key: 'purchases',
    href: '/reports/purchases',
    labelKey: 'reports.report.purchases',
    descriptionKey: 'reports.report.purchasesBody',
    permission: PERMISSIONS.REPORTS_PURCHASES,
    csvFileName: 'purchases.csv',
    apiPath: '/reports/purchases',
  },
];

export function reportsForRole(role: UserRole): ReportDefinition[] {
  return REPORTS.filter((report) => roleHasPermission(role, report.permission));
}

/** The reports that the owner sees as tabs of the sales report. */
export function salesViewsForRole(role: UserRole): SalesView[] {
  const views: SalesView[] = ['period'];

  if (roleHasPermission(role, PERMISSIONS.REPORTS_FULL)) {
    views.push('product', 'category', 'customer', 'staff');
  }

  return views;
}

/** The report of a key, or undefined when the report does not exist. */
export function reportByKey(key: string): ReportDefinition | undefined {
  return REPORTS.find((report) => report.key === key);
}

/** The key of the report of a tab of the sales report. */
export function reportKeyForSalesView(view: SalesView): string {
  if (view === 'period') {
    return 'sales';
  }

  return `salesBy${view.charAt(0).toUpperCase()}${view.slice(1)}`;
}
