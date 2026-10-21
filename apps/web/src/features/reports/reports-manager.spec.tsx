/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { I18nProvider } from '@/components/i18n-provider';
import { ReportsManager } from '@/features/reports/reports-manager';
import {
  downloadReportCsv,
  getDepotSettings,
  getSalesReport,
  getInventoryReport,
} from '@/lib/api-client';
import type { DepotSettings, InventoryReport, SalesReport, UserRole } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';

jest.mock('@/lib/api-client', () => ({
  downloadReportCsv: jest.fn(),
  getDepotSettings: jest.fn(),
  getSalesReport: jest.fn(),
  getInventoryReport: jest.fn(),
  getCreditReport: jest.fn(),
  getProfitReport: jest.fn(),
  getPurchasesReport: jest.fn(),
  getSalesByProductReport: jest.fn(),
  getSalesByCategoryReport: jest.fn(),
  getSalesByCustomerReport: jest.fn(),
  getSalesByStaffReport: jest.fn(),
}));

const downloadMock = downloadReportCsv as jest.MockedFunction<typeof downloadReportCsv>;
const getSettingsMock = getDepotSettings as jest.MockedFunction<typeof getDepotSettings>;
const getSalesReportMock = getSalesReport as jest.MockedFunction<typeof getSalesReport>;
const getInventoryReportMock = getInventoryReport as jest.MockedFunction<typeof getInventoryReport>;

const SETTINGS: DepotSettings = {
  id: 'depot-1',
  name: 'Depot A',
  address: null,
  currency: 'KHR',
  locale: 'EN',
  invoiceFooter: null,
  logoKey: null,
};

const SALES_REPORT: SalesReport = {
  from: '2026-10-01',
  to: '2026-10-31',
  unit: 'day',
  timeZone: 'Asia/Phnom_Penh',
  totals: {
    invoiceCount: 2,
    subtotal: '120.00',
    discountTotal: '0.00',
    total: '120.00',
    paid: '70.00',
    outstanding: '50.00',
  },
  rows: [
    {
      period: '2026-10-01',
      periodStart: '2026-10-01T00:00:00.000Z',
      invoiceCount: 1,
      total: '20.00',
      subtotal: '20.00',
      discountTotal: '0.00',
      paid: '0.00',
      outstanding: '20.00',
    },
    {
      period: '2026-10-02',
      periodStart: '2026-10-02T00:00:00.000Z',
      invoiceCount: 1,
      total: '100.00',
      subtotal: '100.00',
      discountTotal: '0.00',
      paid: '70.00',
      outstanding: '30.00',
    },
  ],
};

const INVENTORY_REPORT: InventoryReport = {
  productCount: 2,
  lowStockCount: 1,
  nearExpiryBatchCount: 0,
  totalStockValue: '70.00',
  rows: [
    {
      productId: 'p1',
      sku: 'BEER-1',
      name: 'ABC Beer',
      category: 'Beer',
      isActive: true,
      trackBatches: false,
      currentStock: '70',
      currentStockReadable: '2 cartons and 22 bottles',
      reorderLevel: '50',
      lowStock: false,
      costPerBaseUnit: '1.0000',
      stockValue: '70.00',
      batches: [],
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

function renderReport(
  reportKey: string,
  role: UserRole = 'OWNER',
  salesView: 'period' | 'product' = 'period',
) {
  setRole(role);

  return render(
    <I18nProvider initialLocale="en">
      <ReportsManager reportKey={reportKey} salesView={salesView} />
    </I18nProvider>,
  );
}

describe('the reports of the depot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSettingsMock.mockResolvedValue(SETTINGS);
    getSalesReportMock.mockResolvedValue(SALES_REPORT);
    getInventoryReportMock.mockResolvedValue(INVENTORY_REPORT);
    downloadMock.mockResolvedValue(undefined);
  });

  it('shows the sales of the period with the money of the depot', async () => {
    renderReport('sales');

    expect(await screen.findByText('Sales over time')).toBeInTheDocument();
    expect((await screen.findAllByText('20 KHR')).length).toBeGreaterThan(0);
    expect(screen.getByText('100 KHR')).toBeInTheDocument();
    expect(screen.getByText('120 KHR')).toBeInTheDocument();
  });

  it('sorts the rows of the report when a header is clicked', async () => {
    const user = userEvent.setup();
    renderReport('sales');

    await screen.findByText('2026-10-01');
    const header = screen.getByRole('button', { name: /^Total/ });

    await user.click(header);

    const rows = screen.getAllByRole('row');

    // the first row is the header, the biggest amount comes first after the click
    expect(rows[1]).toHaveTextContent('2026-10-02');
    expect(rows[2]).toHaveTextContent('2026-10-01');
  });

  it('shows the tabs of the sales report to the owner and only the period to the sales staff', async () => {
    const { unmount } = renderReport('sales', 'OWNER');

    expect(await screen.findByRole('link', { name: 'By product' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'By staff' })).toBeInTheDocument();
    unmount();

    renderReport('sales', 'SALES');

    expect(await screen.findByRole('link', { name: 'By period' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'By product' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'By staff' })).not.toBeInTheDocument();
  });

  it('shows the inventory report to the stock keeper', async () => {
    renderReport('inventory', 'STOCK_KEEPER');

    expect(await screen.findByText('Inventory')).toBeInTheDocument();
    expect(await screen.findByText('2 cartons and 22 bottles')).toBeInTheDocument();
    expect(screen.getAllByText('70 KHR').length).toBeGreaterThan(0);
  });

  it('refuses a report that the role may not read', async () => {
    renderReport('credit', 'SALES');

    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
  });

  it('warns when the report has so many rows that it has no pages', async () => {
    const manyRows = Array.from({ length: 250 }, (_, index) => ({
      period: `2026-10-${String((index % 28) + 1).padStart(2, '0')}`,
      periodStart: '2026-10-01T00:00:00.000Z',
      invoiceCount: 1,
      total: '10.00',
      subtotal: '10.00',
      discountTotal: '0.00',
      paid: '0.00',
      outstanding: '10.00',
    }));

    getSalesReportMock.mockResolvedValue({ ...SALES_REPORT, rows: manyRows });
    renderReport('sales');

    expect(await screen.findByText(/This report has 250 rows/)).toBeInTheDocument();
  });

  it('downloads the report as a CSV file', async () => {
    const user = userEvent.setup();
    renderReport('sales');

    await screen.findByText('Sales over time');
    await user.click(screen.getByRole('button', { name: 'Download CSV' }));

    await waitFor(() => {
      expect(downloadMock).toHaveBeenCalledWith(
        'sales.csv',
        '/reports/sales',
        expect.any(URLSearchParams),
      );
    });
  });

  it('changes the period of the report with the picker', async () => {
    const user = userEvent.setup();
    renderReport('sales');

    await screen.findByText('Sales over time');
    await user.click(screen.getByRole('button', { name: 'Last 7 days' }));

    await waitFor(() => {
      expect(getSalesReportMock).toHaveBeenCalledWith(expect.objectContaining({ unit: 'day' }));
    });
  });
});
