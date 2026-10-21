/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { I18nProvider } from '@/components/i18n-provider';
import { DashboardManager } from '@/features/dashboard/dashboard-manager';
import { getDashboard, getDepotSettings, getSalesReport } from '@/lib/api-client';
import type { Dashboard, DepotSettings, SalesReport, UserRole } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';

jest.mock('@/lib/api-client', () => ({
  getDashboard: jest.fn(),
  getDepotSettings: jest.fn(),
  getSalesReport: jest.fn(),
}));

const getDashboardMock = getDashboard as jest.MockedFunction<typeof getDashboard>;
const getSettingsMock = getDepotSettings as jest.MockedFunction<typeof getDepotSettings>;
const getSalesReportMock = getSalesReport as jest.MockedFunction<typeof getSalesReport>;

const SETTINGS: DepotSettings = {
  id: 'depot-1',
  name: 'Depot A',
  address: null,
  currency: 'KHR',
  locale: 'EN',
  invoiceFooter: null,
  logoKey: null,
};

function dashboard(overrides: Partial<Dashboard> = {}): Dashboard {
  return {
    kpis: {
      todaySales: '1200.00',
      monthSales: '4200.00',
      monthInvoiceCount: 18,
      totalOutstandingCredit: '1250.00',
      overdueAmount: '430.00',
      monthGrossProfit: '1260.00',
      monthMarginPercent: '30.00',
      lowStockCount: 3,
      nearExpiryCount: 2,
      ...overrides.kpis,
    },
    charts: {
      salesTrend: [{ period: '2026-10-21', total: '120.00', invoiceCount: 1 }],
      topProductsByRevenue: [
        {
          productId: 'p1',
          name: 'ABC Beer',
          sku: 'BEER-1',
          revenue: '600.00',
          quantityBase: '400',
        },
      ],
      topProductsByQuantity: [
        {
          productId: 'p1',
          name: 'ABC Beer',
          sku: 'BEER-1',
          revenue: '600.00',
          quantityBase: '400',
        },
      ],
      salesByCategory: [{ categoryId: 'c1', name: 'Beer', total: '600.00' }],
      topCustomersBySales: [
        { customerId: 'cu1', name: 'Sokha', total: '300.00', balance: '100.00' },
      ],
      topCustomersByBalance: [
        { customerId: 'cu1', name: 'Sokha', total: '300.00', balance: '100.00' },
      ],
      creditAgeing: { '0-30': '100.00', '31-60': '50.00', OVER_60: '25.00' },
      salesByWeekday: [{ name: 'Monday', weekday: 1, total: '100.00', invoiceCount: 2 }],
      slowMovingStock: [
        { productId: 'p2', name: 'Cola', sku: 'SODA-1', currentStock: '120', soldQuantity: '0' },
      ],
      purchasesVersusSales: [{ period: '2026-10-01', purchases: '900.00', sales: '1200.00' }],
      ...overrides.charts,
    },
  };
}

const SALES_REPORT: SalesReport = {
  from: '2026-10-08',
  to: '2026-10-21',
  unit: 'day',
  timeZone: 'Asia/Phnom_Penh',
  totals: {
    invoiceCount: 14,
    subtotal: '1200.00',
    discountTotal: '0.00',
    total: '1200.00',
    paid: '900.00',
    outstanding: '300.00',
  },
  rows: [
    {
      period: '2026-10-21',
      periodStart: '2026-10-21T00:00:00.000Z',
      invoiceCount: 1,
      total: '120.00',
    },
  ],
};

function setRole(role: UserRole) {
  useSessionStore.setState({
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'user@example.com',
      phone: null,
      role,
      depotId: 'depot-1',
      mustChangePassword: false,
    },
    role,
    depot: { id: 'depot-1', name: 'Depot A', status: 'APPROVED' },
    accessToken: 'access-token',
    status: 'authenticated',
    logoutReason: null,
  });
}

function renderDashboard(role: UserRole = 'OWNER') {
  setRole(role);

  return render(
    <I18nProvider initialLocale="en">
      <DashboardManager />
    </I18nProvider>,
  );
}

describe('the dashboard of the depot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getDashboardMock.mockResolvedValue(dashboard());
    getSettingsMock.mockResolvedValue(SETTINGS);
    getSalesReportMock.mockResolvedValue(SALES_REPORT);
  });

  it('shows the cards of the owner with the money of the depot and a link to every report', async () => {
    renderDashboard('OWNER');

    expect(await screen.findByText('Sales today')).toBeInTheDocument();
    expect(screen.getByText('1,200 KHR')).toBeInTheDocument();
    expect(screen.getByText('Sales this month')).toBeInTheDocument();
    expect(screen.getByText('4,200 KHR')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('Outstanding credit')).toBeInTheDocument();
    expect(screen.getByText('1,250 KHR')).toBeInTheDocument();
    expect(screen.getByText('Overdue amount')).toBeInTheDocument();
    expect(screen.getByText('430 KHR')).toBeInTheDocument();
    expect(screen.getByText('30.00%')).toBeInTheDocument();

    const creditLink = screen.getByText('Outstanding credit').closest('a');

    expect(creditLink).toHaveAttribute('href', '/reports/credit');
    expect(screen.getByText('Gross profit this month').closest('a')).toHaveAttribute(
      'href',
      '/reports/profit',
    );
    expect(screen.getByText('Products with low stock').closest('a')).toHaveAttribute(
      'href',
      '/reports/inventory',
    );
  });

  it('shows the charts of the owner', async () => {
    renderDashboard('OWNER');

    expect(await screen.findByText('Sales over time')).toBeInTheDocument();
    expect(screen.getByText('Top 10 products by revenue')).toBeInTheDocument();
    expect(screen.getByText('Sales by category')).toBeInTheDocument();
    expect(screen.getByText('Credit ageing')).toBeInTheDocument();
    expect(screen.getByText('Sales by day of the week')).toBeInTheDocument();
    expect(screen.getByText('Purchases and sales')).toBeInTheDocument();
    expect(screen.getAllByText('Slow-moving stock').length).toBeGreaterThan(0);
    expect(screen.getByText('Cola')).toBeInTheDocument();
  });

  it('gives the sales staff only the sales cards and the trend', async () => {
    renderDashboard('SALES');

    expect(await screen.findByText('Sales today')).toBeInTheDocument();
    expect(screen.queryByText('Outstanding credit')).not.toBeInTheDocument();
    expect(screen.queryByText('Gross profit this month')).not.toBeInTheDocument();
    expect(screen.queryByText('Products with low stock')).not.toBeInTheDocument();
    expect(screen.getByText('Sales over time')).toBeInTheDocument();
    expect(screen.queryByText('Top 10 products by revenue')).not.toBeInTheDocument();
    expect(screen.queryByText('Credit ageing')).not.toBeInTheDocument();
    expect(screen.queryByText('Slow-moving stock')).not.toBeInTheDocument();
  });

  it('gives the stock keeper the inventory cards and the slow-moving stock', async () => {
    renderDashboard('STOCK_KEEPER');

    expect(await screen.findByText('Products with low stock')).toBeInTheDocument();
    expect(screen.getByText('Batches that expire soon')).toBeInTheDocument();
    expect(screen.queryByText('Sales today')).not.toBeInTheDocument();
    expect(screen.queryByText('Outstanding credit')).not.toBeInTheDocument();
    expect(screen.getAllByText('Slow-moving stock').length).toBeGreaterThan(0);
  });

  it('switches the grouping of the trend', async () => {
    const user = userEvent.setup();
    renderDashboard('OWNER');

    await screen.findByText('Sales over time');
    await user.click(screen.getByRole('button', { name: 'Week' }));

    await waitFor(() => {
      expect(getSalesReportMock).toHaveBeenCalledWith(expect.objectContaining({ unit: 'week' }));
    });
  });

  it('shows the error of the API', async () => {
    getDashboardMock.mockRejectedValue(new Error('boom'));
    renderDashboard('OWNER');

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
