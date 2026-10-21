/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { I18nProvider } from '@/components/i18n-provider';
import { InvoicesManager } from '@/features/invoices/invoices-manager';
import { getDepotSettings, listCustomers, listInvoices, voidInvoice } from '@/lib/api-client';
import type { Customer, DepotSettings, Invoice, Paginated } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';

jest.mock('@/lib/api-client', () => ({
  listInvoices: jest.fn(),
  listCustomers: jest.fn(),
  getDepotSettings: jest.fn(),
  voidInvoice: jest.fn(),
}));

const listInvoicesMock = listInvoices as jest.MockedFunction<typeof listInvoices>;
const listCustomersMock = listCustomers as jest.MockedFunction<typeof listCustomers>;
const settingsMock = getDepotSettings as jest.MockedFunction<typeof getDepotSettings>;
const voidInvoiceMock = voidInvoice as jest.MockedFunction<typeof voidInvoice>;

const CUSTOMER: Customer = {
  id: 'customer-1',
  name: 'Sokha Restaurant',
  phone: null,
  email: null,
  address: null,
  type: 'WHOLESALE',
  creditLimit: null,
  paymentTermDays: 30,
  notes: null,
  isActive: true,
  isWalkIn: false,
  balance: '100.00',
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-01T08:00:00.000Z',
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

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'invoice-1',
    invoiceNumber: 'INV-000001',
    status: 'COMPLETED',
    paymentStatus: 'UNPAID',
    customerId: CUSTOMER.id,
    customerName: CUSTOMER.name,
    subtotal: '100.00',
    discountTotal: '0.00',
    discountType: null,
    discountValue: null,
    total: '100.00',
    outstanding: '100.00',
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
    ...overrides,
  };
}

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

function renderManager(role: 'OWNER' | 'SALES' = 'OWNER') {
  setRole(role);

  return render(
    <I18nProvider initialLocale="en">
      <InvoicesManager />
    </I18nProvider>,
  );
}

describe('InvoicesManager void flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listInvoicesMock.mockResolvedValue({
      data: [invoice()],
      meta: { page: 1, pageSize: 20, total: 1 },
    } as Paginated<Invoice>);
    listCustomersMock.mockResolvedValue({
      data: [CUSTOMER],
      meta: { page: 1, pageSize: 100, total: 1 },
    } as Paginated<Customer>);
    settingsMock.mockResolvedValue(SETTINGS);
    voidInvoiceMock.mockResolvedValue(
      invoice({
        status: 'VOIDED',
        voidReason: 'The customer returned the goods',
        voidedAt: '2026-10-21T10:00:00.000Z',
        refundDue: '100.00',
      }),
    );
  });

  it('lets the owner void an invoice with a reason', async () => {
    const user = userEvent.setup();
    renderManager('OWNER');

    await user.click(await screen.findByRole('button', { name: 'View' }));
    await user.click(screen.getByRole('button', { name: 'Void invoice' }));

    expect(await screen.findByText('Void this invoice?')).toBeInTheDocument();

    await user.type(
      screen.getByLabelText('Reason for the void'),
      'The customer returned the goods',
    );
    await user.click(screen.getByRole('button', { name: 'Void the invoice' }));

    await waitFor(() => {
      expect(voidInvoiceMock).toHaveBeenCalledWith('invoice-1', 'The customer returned the goods');
    });

    expect(await screen.findByText('The invoice was voided.')).toBeInTheDocument();
    expect(screen.getByText('Refund due')).toBeInTheDocument();
    expect(screen.getAllByText('100 KHR').length).toBeGreaterThan(0);
  });

  it('hides the void button from sales', async () => {
    renderManager('SALES');

    await userEvent.setup().click(await screen.findByRole('button', { name: 'View' }));

    expect(screen.queryByRole('button', { name: 'Void invoice' })).not.toBeInTheDocument();
  });
});
