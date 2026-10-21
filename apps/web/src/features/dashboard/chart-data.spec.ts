import {
  ageingData,
  categoryData,
  customerBalanceData,
  customerSalesData,
  productQuantityData,
  productRevenueData,
  purchasesVersusSalesData,
  salesTrendData,
  slowMovingData,
  toChartNumber,
  weekdayData,
} from '@/features/dashboard/chart-data';

describe('the data of the charts', () => {
  it('turns a decimal string into the number of the chart', () => {
    expect(toChartNumber('1234.50')).toBe(1234.5);
    expect(toChartNumber('0')).toBe(0);
    expect(toChartNumber('not a number')).toBe(0);
  });

  it('keeps the exact amount of the API next to the number of the chart', () => {
    const data = salesTrendData([{ period: '2026-10-21', total: '1234.50', invoiceCount: 3 }]);

    expect(data).toEqual([
      { key: '2026-10-21', label: '2026-10-21', value: 1234.5, display: '1234.50' },
    ]);
  });

  it('maps the products by revenue and by quantity', () => {
    const points = [
      { productId: 'p1', name: 'ABC Beer', sku: 'BEER-1', revenue: '600.00', quantityBase: '400' },
    ];

    expect(productRevenueData(points)[0]).toMatchObject({
      key: 'p1',
      label: 'ABC Beer',
      value: 600,
      display: '600.00',
    });
    expect(productQuantityData(points)[0]).toMatchObject({
      value: 400,
      display: '400',
    });
  });

  it('maps the categories and the customers', () => {
    expect(
      categoryData([{ categoryId: null, name: 'Uncategorised', total: '10.00' }])[0],
    ).toMatchObject({ key: 'uncategorised', value: 10 });

    const customers = [{ customerId: 'c1', name: 'Sokha', total: '300.00', balance: '120.00' }];

    expect(customerSalesData(customers)[0]).toMatchObject({ value: 300 });
    expect(customerBalanceData(customers)[0]).toMatchObject({
      value: 120,
      display: '120.00',
    });
  });

  it('keeps the three ageing buckets', () => {
    const data = ageingData({ '0-30': '100.00', '31-60': '50.00', OVER_60: '25.00' });

    expect(data.map((entry) => entry.key)).toEqual(['0-30', '31-60', 'OVER_60']);
    expect(data.map((entry) => entry.value)).toEqual([100, 50, 25]);
  });

  it('fills the days of the week that had no sales', () => {
    const data = weekdayData([
      { name: 'Monday', weekday: 1, total: '100.00', invoiceCount: 2 },
      { name: 'Friday', weekday: 5, total: '50.00', invoiceCount: 1 },
    ]);

    expect(data).toHaveLength(7);
    expect(data[0]).toMatchObject({ label: 'Monday', value: 100, display: '100.00' });
    expect(data[1]).toMatchObject({ label: 'Tuesday', value: 0, display: '0.00' });
    expect(data[4]).toMatchObject({ label: 'Friday', value: 50 });
    expect(data[6]).toMatchObject({ label: 'Sunday', value: 0 });
  });

  it('maps the purchases and the sales of every month', () => {
    const data = purchasesVersusSalesData([
      { period: '2026-10-01', purchases: '900.00', sales: '1200.00' },
    ]);

    expect(data[0]).toEqual({
      period: '2026-10-01',
      purchases: 900,
      sales: 1200,
      purchasesDisplay: '900.00',
      salesDisplay: '1200.00',
    });
  });

  it('maps the slow-moving stock', () => {
    const data = slowMovingData([
      {
        productId: 'p1',
        name: 'Cola',
        sku: 'SODA-1',
        currentStock: '120',
        soldQuantity: '0',
      },
    ]);

    expect(data[0]).toMatchObject({ key: 'p1', name: 'Cola', currentStock: '120' });
  });
});
