/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { I18nProvider } from '@/components/i18n-provider';
import { InvoiceScreen } from '@/features/invoices/invoice-screen';
import { createInvoice, getDepotSettings, listCustomers, listStock } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import type { Customer, DepotSettings, Invoice, Paginated, StockItem } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';

jest.mock('@/lib/api-client', () => ({
  listCustomers: jest.fn(),
  listStock: jest.fn(),
  getDepotSettings: jest.fn(),
  createInvoice: jest.fn(),
}));

const listCustomersMock = listCustomers as jest.MockedFunction<typeof listCustomers>;
const listStockMock = listStock as jest.MockedFunction<typeof listStock>;
const settingsMock = getDepotSettings as jest.MockedFunction<typeof getDepotSettings>;
const createInvoiceMock = createInvoice as jest.MockedFunction<typeof createInvoice>;

const WALK_IN: Customer = {
  id: 'customer-walk-in',
  name: 'Walk-in',
  phone: null,
  email: null,
  address: null,
  type: 'RETAIL',
  creditLimit: null,
  paymentTermDays: null,
  notes: null,
  isActive: true,
  isWalkIn: true,
  balance: '0',
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-01T08:00:00.000Z',
};

const CUSTOMER: Customer = {
  ...WALK_IN,
  id: 'customer-1',
  name: 'Sokha Restaurant',
  type: 'WHOLESALE',
  isWalkIn: false,
  creditLimit: '500.00',
  paymentTermDays: 30,
  balance: '120.00',
};

const STOCK_ITEM: StockItem = {
  id: 'product-1',
  sku: 'BEER-001',
  name: 'ABC Beer 330ml',
  description: null,
  category: null,
  reorderLevel: '120',
  costPrice: '1.0000',
  trackBatches: false,
  isActive: true,
  baseUnit: {
    id: 'unit-bottle',
    name: 'bottle',
    conversionFactor: '1',
    isBaseUnit: true,
    isActive: true,
    prices: [
      { id: 'price-1', type: 'RETAIL', amount: '1.50', updatedAt: '2026-10-21T09:00:00.000Z' },
    ],
  },
  units: [
    {
      id: 'unit-bottle',
      name: 'bottle',
      conversionFactor: '1',
      isBaseUnit: true,
      isActive: true,
      prices: [
        { id: 'price-1', type: 'RETAIL', amount: '1.50', updatedAt: '2026-10-21T09:00:00.000Z' },
      ],
    },
    {
      id: 'unit-carton',
      name: 'carton',
      conversionFactor: '24',
      isBaseUnit: false,
      isActive: true,
      prices: [
        { id: 'price-2', type: 'RETAIL', amount: '36.00', updatedAt: '2026-10-21T09:00:00.000Z' },
        {
          id: 'price-3',
          type: 'WHOLESALE',
          amount: '30.00',
          updatedAt: '2026-10-21T09:00:00.000Z',
        },
      ],
    },
  ],
  currentStock: '288',
  currentStockReadable: '12 cartons',
  lowStock: false,
  batches: [],
};

const SETTINGS: DepotSettings = {
  id: 'depot-1',
  name: 'Depot A',
  address: null,
  currency: 'KHR',
  locale: 'EN',
  invoiceFooter: null,
  logoKey: null,
};

const INVOICE: Invoice = {
  id: 'invoice-1',
  invoiceNumber: 'INV-000001',
  status: 'COMPLETED',
  paymentStatus: 'UNPAID',
  customerId: CUSTOMER.id,
  customerName: CUSTOMER.name,
  subtotal: '30.00',
  discountTotal: '0.00',
  discountType: null,
  discountValue: null,
  total: '30.00',
  outstanding: '30.00',
  paidAmount: '0.00',
  refundDue: '0.00',
  orderDate: '2026-10-21T09:00:00.000Z',
  dueDate: '2026-11-20T09:00:00.000Z',
  notes: null,
  voidReason: null,
  voidedAt: null,
  createdBy: 'Dara Sok',
  items: [],
  payments: [],
  creditLimitWarning: null,
};

function setRole(role: 'OWNER' | 'SALES') {
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

function renderScreen(role: 'OWNER' | 'SALES' = 'SALES') {
  setRole(role);
  const onSaved = jest.fn();
  const onCancel = jest.fn();

  const view = render(
    <I18nProvider initialLocale="en">
      <InvoiceScreen onSaved={onSaved} onCancel={onCancel} />
    </I18nProvider>,
  );

  return { onSaved, onCancel, unmount: view.unmount };
}

describe('InvoiceScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listCustomersMock.mockResolvedValue({
      data: [WALK_IN, CUSTOMER],
      meta: { page: 1, pageSize: 100, total: 2 },
    } as Paginated<Customer>);
    listStockMock.mockResolvedValue({
      data: [STOCK_ITEM],
      meta: { page: 1, pageSize: 50, total: 1 },
    } as Paginated<StockItem>);
    settingsMock.mockResolvedValue(SETTINGS);
    createInvoiceMock.mockResolvedValue(INVOICE);
  });

  /** Searches for the product and adds the first result with the keyboard. */
  async function addFirstLine(user: ReturnType<typeof userEvent.setup>) {
    const search = await screen.findByLabelText('Search products');
    await user.click(search);
    await user.type(search, 'beer');
    await screen.findAllByText('ABC Beer 330ml');

    search.focus();
    await user.keyboard('{Enter}');
    await screen.findByText('1 line(s)');
  }

  it('starts with the walk-in customer and shows the prices of the customer type', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByLabelText('Customer')).toHaveValue('customer-walk-in');
    });

    expect((await screen.findAllByText('ABC Beer 330ml')).length).toBe(2);
    expect(screen.getByText('36.00 KHR')).toBeInTheDocument();
    expect(screen.getByText('1.50 KHR')).toBeInTheDocument();
    expect(screen.queryByText('30.00 KHR')).not.toBeInTheDocument();
  });

  it('adds a line with the keyboard and calculates the total', async () => {
    const user = userEvent.setup();
    renderScreen();

    await addFirstLine(user);

    expect(await screen.findByText('1 line(s)')).toBeInTheDocument();
    expect(screen.getAllByText('1.5 KHR').length).toBeGreaterThan(0);
  });

  it('lets the owner change the price but not sales', async () => {
    const user = userEvent.setup();
    const { unmount } = renderScreen('SALES');

    await addFirstLine(user);
    expect(screen.getByLabelText('Unit price')).toBeDisabled();

    unmount();

    renderScreen('OWNER');
    await addFirstLine(user);
    expect(screen.getByLabelText('Unit price')).toBeEnabled();
  });

  it('sends the invoice with an idempotency key and the checkout payment', async () => {
    const user = userEvent.setup();
    const { onSaved } = renderScreen();

    await addFirstLine(user);

    await user.click(await screen.findByLabelText('The customer pays now'));
    await user.type(screen.getByLabelText('Amount paid'), '10');
    await user.click(screen.getByRole('button', { name: 'Save invoice' }));

    await waitFor(() => {
      expect(createInvoiceMock).toHaveBeenCalledTimes(1);
    });

    const payload = createInvoiceMock.mock.calls[0][0];

    expect(payload.idempotencyKey).toBeTruthy();
    expect(payload.customerId).toBe('customer-walk-in');
    expect(payload.lines).toHaveLength(1);
    expect(payload.payment).toMatchObject({ amount: '10', method: 'CASH' });
    expect(onSaved).toHaveBeenCalledWith(INVOICE, 'KHR');
  });

  it('keeps the same idempotency key when the server refuses the invoice', async () => {
    const user = userEvent.setup();
    createInvoiceMock.mockRejectedValue(
      new ApiError('Insufficient stock: available 2, requested 10', 400),
    );
    renderScreen();

    await addFirstLine(user);

    await user.click(screen.getByRole('button', { name: 'Save invoice' }));

    expect(
      await screen.findByText('There is not enough stock for this invoice.'),
    ).toBeInTheDocument();

    const firstKey = createInvoiceMock.mock.calls[0][0].idempotencyKey;

    await user.click(screen.getByRole('button', { name: 'Save invoice' }));

    await waitFor(() => {
      expect(createInvoiceMock).toHaveBeenCalledTimes(2);
    });

    expect(createInvoiceMock.mock.calls[1][0].idempotencyKey).toBe(firstKey);
  });
});
