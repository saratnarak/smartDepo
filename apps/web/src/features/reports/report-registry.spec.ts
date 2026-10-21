import { reportKeyForSalesView, reportsForRole, salesViewsForRole } from './report-registry';

describe('the reports of the roles', () => {
  it('gives the owner every report', () => {
    const keys = reportsForRole('OWNER').map((report) => report.key);

    expect(keys).toEqual([
      'sales',
      'salesByProduct',
      'salesByCategory',
      'salesByCustomer',
      'salesByStaff',
      'inventory',
      'credit',
      'profit',
      'purchases',
    ]);
  });

  it('gives the sales staff only the sales report', () => {
    expect(reportsForRole('SALES').map((report) => report.key)).toEqual(['sales']);
  });

  it('gives the stock keeper the inventory and the purchase report', () => {
    expect(reportsForRole('STOCK_KEEPER').map((report) => report.key)).toEqual([
      'inventory',
      'purchases',
    ]);
  });

  it('gives the delivery staff and the platform admin no report of a depot', () => {
    expect(reportsForRole('DELIVERY')).toEqual([]);
    expect(reportsForRole('PLATFORM_ADMIN')).toEqual([]);
  });

  it('shows the tabs of the sales report to the owner only', () => {
    expect(salesViewsForRole('OWNER')).toEqual([
      'period',
      'product',
      'category',
      'customer',
      'staff',
    ]);
    expect(salesViewsForRole('SALES')).toEqual(['period']);
    expect(salesViewsForRole('STOCK_KEEPER')).toEqual(['period']);
  });

  it('maps a tab of the sales report to its report', () => {
    expect(reportKeyForSalesView('period')).toBe('sales');
    expect(reportKeyForSalesView('product')).toBe('salesByProduct');
    expect(reportKeyForSalesView('staff')).toBe('salesByStaff');
  });
});
