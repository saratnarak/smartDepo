/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { I18nProvider } from '@/components/i18n-provider';
import { RecordPaymentDialog } from '@/features/customers/record-payment-dialog';
import { listInvoices, recordPayment } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import type { Customer, Invoice, Paginated, Payment } from '@/lib/types';

jest.mock('@/lib/api-client', () => ({
  listInvoices: jest.fn(),
  recordPayment: jest.fn(),
}));

const listInvoicesMock = listInvoices as jest.MockedFunction<typeof listInvoices>;
const recordPaymentMock = recordPayment as jest.MockedFunction<typeof recordPayment>;

const CUSTOMER: Customer = {
  id: 'customer-1',
  name: 'Sokha Restaurant',
  phone: null,
  email: null,
  address: null,
  type: 'WHOLESALE',
  creditLimit: '500.00',
  paymentTermDays: 30,
  notes: null,
  isActive: true,
  isWalkIn: false,
  balance: '120.00',
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-01T08:00:00.000Z',
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
    orderDate: '2026-10-01T09:00:00.000Z',
    dueDate: '2026-10-31T09:00:00.000Z',
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

const PAYMENT: Payment = {
  id: 'payment-1',
  customerId: CUSTOMER.id,
  customerName: CUSTOMER.name,
  amount: '50.00',
  allocatedAmount: '50.00',
  unallocatedAmount: '0.00',
  method: 'CASH',
  reference: null,
  notes: null,
  paidAt: '2026-10-21T09:00:00.000Z',
  receivedBy: 'Dara Sok',
  allocations: [{ invoiceId: 'invoice-1', invoiceNumber: 'INV-000001', amount: '50.00' }],
  createdAt: '2026-10-21T09:00:00.000Z',
};

function renderDialog() {
  const onRecorded = jest.fn();
  const onClose = jest.fn();

  render(
    <I18nProvider initialLocale="en">
      <RecordPaymentDialog open customer={CUSTOMER} onRecorded={onRecorded} onClose={onClose} />
    </I18nProvider>,
  );

  return { onRecorded, onClose };
}

describe('RecordPaymentDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listInvoicesMock.mockResolvedValue({
      data: [invoice()],
      meta: { page: 1, pageSize: 100, total: 1 },
    } as Paginated<Invoice>);
    recordPaymentMock.mockResolvedValue(PAYMENT);
  });

  it('records a payment and lets the server allocate it to the oldest invoice', async () => {
    const user = userEvent.setup();
    const { onRecorded } = renderDialog();

    await user.type(screen.getByLabelText('Amount'), '50');
    await user.selectOptions(screen.getByLabelText('Payment method'), 'BANK_TRANSFER');
    await user.click(screen.getByRole('button', { name: 'Record payment' }));

    await waitFor(() => {
      expect(recordPaymentMock).toHaveBeenCalledTimes(1);
    });

    const payload = recordPaymentMock.mock.calls[0][0];

    expect(payload.customerId).toBe(CUSTOMER.id);
    expect(payload.amount).toBe('50');
    expect(payload.method).toBe('BANK_TRANSFER');
    expect(payload.allocations).toBeUndefined();
    expect(onRecorded).toHaveBeenCalledWith(PAYMENT);
  });

  it('sends the manual allocations of the customer', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText('Amount'), '40');
    await user.click(screen.getByRole('button', { name: 'Choose the invoices' }));

    expect(await screen.findByText('INV-000001')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Allocation amount'), '40');
    await user.click(screen.getByRole('button', { name: 'Record payment' }));

    await waitFor(() => {
      expect(recordPaymentMock).toHaveBeenCalledTimes(1);
    });

    expect(recordPaymentMock.mock.calls[0][0].allocations).toEqual([
      { invoiceId: 'invoice-1', amount: '40' },
    ]);
  });

  it('refuses allocations that are bigger than the payment', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText('Amount'), '10');
    await user.click(screen.getByRole('button', { name: 'Choose the invoices' }));
    await screen.findByText('INV-000001');

    await user.type(screen.getByLabelText('Allocation amount'), '50');
    await user.click(screen.getByRole('button', { name: 'Record payment' }));

    expect(
      await screen.findByText('The allocations are bigger than the payment.'),
    ).toBeInTheDocument();
    expect(recordPaymentMock).not.toHaveBeenCalled();
  });

  it('shows the message of the API when an allocation does not fit the invoice', async () => {
    const user = userEvent.setup();
    recordPaymentMock.mockRejectedValue(
      new ApiError('The allocation for INV-000001 is bigger than the open amount of 20.00', 400),
    );
    renderDialog();

    await user.type(screen.getByLabelText('Amount'), '50');
    await user.click(screen.getByRole('button', { name: 'Record payment' }));

    expect(
      await screen.findByText(
        'The allocation for INV-000001 is bigger than the open amount of 20.00',
      ),
    ).toBeInTheDocument();
  });
});
