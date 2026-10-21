import { Prisma } from '../src/generated/prisma/client.js';
import {
  calculateDiscountAmount,
  calculateInvoiceTotals,
  calculateLineTotals,
  outstandingFor,
  paymentStatusFor,
} from '../src/modules/invoices/invoice-calculations.js';

const money = (value: string): Prisma.Decimal => new Prisma.Decimal(value);

describe('invoice calculations', () => {
  it('multiplies the quantity with the unit price and rounds to money', () => {
    const line = calculateLineTotals({ quantity: money('12'), unitPrice: money('24.00') });

    expect(line.gross.toFixed(2)).toBe('288.00');
    expect(line.discountAmount.toFixed(2)).toBe('0.00');
    expect(line.lineTotal.toFixed(2)).toBe('288.00');
  });

  it('keeps fractional quantities exact', () => {
    const line = calculateLineTotals({ quantity: money('2.5'), unitPrice: money('1.50') });

    expect(line.gross.toFixed(2)).toBe('3.75');
    expect(line.lineTotal.toFixed(2)).toBe('3.75');
  });

  it('applies a fixed discount and a percentage discount', () => {
    expect(calculateDiscountAmount(money('100'), { type: 'AMOUNT', value: '10' }).toFixed(2)).toBe(
      '10.00',
    );
    expect(calculateDiscountAmount(money('100'), { type: 'PERCENT', value: '10' }).toFixed(2)).toBe(
      '10.00',
    );
    expect(
      calculateDiscountAmount(money('99.99'), { type: 'PERCENT', value: '12.5' }).toFixed(2),
    ).toBe('12.50');
  });

  it('never discounts more than the amount it discounts', () => {
    expect(calculateDiscountAmount(money('50'), { type: 'AMOUNT', value: '80' }).toFixed(2)).toBe(
      '50.00',
    );
    expect(calculateDiscountAmount(money('50'), { type: 'PERCENT', value: '150' }).toFixed(2)).toBe(
      '50.00',
    );
  });

  it('rejects a negative discount value', () => {
    expect(() => calculateDiscountAmount(money('50'), { type: 'AMOUNT', value: '-1' })).toThrow(
      'must not be negative',
    );
  });

  it('adds the line totals and applies the invoice discount', () => {
    const lines = [{ lineTotal: money('288.00') }, { lineTotal: money('12.50') }];

    const totals = calculateInvoiceTotals(lines);

    expect(totals.subtotal.toFixed(2)).toBe('300.50');
    expect(totals.discountTotal.toFixed(2)).toBe('0.00');
    expect(totals.total.toFixed(2)).toBe('300.50');

    const discounted = calculateInvoiceTotals(lines, { type: 'PERCENT', value: '10' });

    expect(discounted.subtotal.toFixed(2)).toBe('300.50');
    expect(discounted.discountTotal.toFixed(2)).toBe('30.05');
    expect(discounted.total.toFixed(2)).toBe('270.45');
  });

  it('derives the payment status from the allocated money', () => {
    expect(paymentStatusFor(money('100'), money('100'))).toBe('PAID');
    expect(paymentStatusFor(money('100'), money('40'))).toBe('PARTIAL');
    expect(paymentStatusFor(money('100'), money('0'))).toBe('UNPAID');
  });

  it('never reports a negative outstanding amount', () => {
    expect(outstandingFor(money('100'), money('40')).toFixed(2)).toBe('60.00');
    expect(outstandingFor(money('100'), money('120')).toFixed(2)).toBe('0.00');
    expect(outstandingFor(money('0'), money('0')).toFixed(2)).toBe('0.00');
  });
});
