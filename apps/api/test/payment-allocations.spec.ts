import { Prisma } from '../src/generated/prisma/client.js';
import {
  AllocationError,
  allocateAcrossInvoices,
  validateAllocations,
  type OpenInvoice,
} from '../src/modules/payments/payment-allocations.js';

const money = (value: string): Prisma.Decimal => new Prisma.Decimal(value);

const INVOICES: OpenInvoice[] = [
  {
    id: 'invoice-1',
    invoiceNumber: 'INV-000001',
    total: money('100.00'),
    allocated: money('0'),
    orderDate: new Date('2026-10-01T00:00:00.000Z'),
  },
  {
    id: 'invoice-2',
    invoiceNumber: 'INV-000002',
    total: money('200.00'),
    allocated: money('50.00'),
    orderDate: new Date('2026-10-02T00:00:00.000Z'),
  },
  {
    id: 'invoice-3',
    invoiceNumber: 'INV-000003',
    total: money('300.00'),
    allocated: money('300.00'),
    orderDate: new Date('2026-10-03T00:00:00.000Z'),
  },
];

describe('payment allocation', () => {
  it('pays the oldest open invoice first', () => {
    const allocations = allocateAcrossInvoices(money('120'), INVOICES);

    expect(allocations).toHaveLength(2);
    expect(allocations[0].invoiceId).toBe('invoice-1');
    expect(allocations[0].amount.toFixed(2)).toBe('100.00');
    expect(allocations[1].invoiceId).toBe('invoice-2');
    expect(allocations[1].amount.toFixed(2)).toBe('20.00');
  });

  it('skips invoices that are already paid', () => {
    const allocations = allocateAcrossInvoices(money('50'), INVOICES);

    expect(allocations).toHaveLength(1);
    expect(allocations[0].invoiceId).toBe('invoice-1');
    expect(allocations[0].amount.toFixed(2)).toBe('50.00');
  });

  it('stops when there is nothing left to pay', () => {
    expect(allocateAcrossInvoices(money('0'), INVOICES)).toEqual([]);
    expect(allocateAcrossInvoices(money('1000'), INVOICES)).toHaveLength(2);
  });

  it('rejects an allocation that is bigger than the open amount', () => {
    const invoices = new Map(INVOICES.map((invoice) => [invoice.id, invoice]));

    expect(() =>
      validateAllocations(
        money('500'),
        [{ invoiceId: 'invoice-2', amount: money('200') }],
        invoices,
      ),
    ).toThrow(AllocationError);
  });

  it('rejects allocations that add up to more than the payment', () => {
    const invoices = new Map(INVOICES.map((invoice) => [invoice.id, invoice]));

    expect(() =>
      validateAllocations(
        money('50'),
        [
          { invoiceId: 'invoice-1', amount: money('40') },
          { invoiceId: 'invoice-2', amount: money('40') },
        ],
        invoices,
      ),
    ).toThrow('more than the payment');
  });

  it('rejects an allocation for an invoice that does not exist', () => {
    const invoices = new Map(INVOICES.map((invoice) => [invoice.id, invoice]));

    expect(() =>
      validateAllocations(money('50'), [{ invoiceId: 'invoice-x', amount: money('10') }], invoices),
    ).toThrow('does not exist');
  });

  it('accepts allocations that fit', () => {
    const invoices = new Map(INVOICES.map((invoice) => [invoice.id, invoice]));

    expect(() =>
      validateAllocations(money('50'), [{ invoiceId: 'invoice-1', amount: money('40') }], invoices),
    ).not.toThrow();
  });
});
