import {
  applyDiscount,
  compareDecimals,
  draftSubtotal,
  draftTotals,
  keyForAttempt,
  lineBaseQuantity,
  lineDiscount,
  lineGross,
  lineTotal,
  newIdempotencyKey,
  subtractDecimals,
  usableBatchQuantity,
  type InvoiceLineDraft,
} from '@/features/invoices/invoice-draft';

function line(overrides: Partial<InvoiceLineDraft> = {}): InvoiceLineDraft {
  return {
    productId: 'product-1',
    productSku: 'BEER-001',
    productName: 'ABC Beer 330ml',
    unitId: 'unit-carton',
    unitName: 'carton',
    conversionFactor: '24',
    quantity: '12',
    unitPrice: '24.00',
    priceOverridden: false,
    discountType: null,
    discountValue: '',
    trackBatches: false,
    ...overrides,
  };
}

describe('invoice draft calculations', () => {
  it('multiplies the quantity with the unit price', () => {
    expect(lineGross(line())).toBe('288');
    expect(lineTotal(line())).toBe('288');
    expect(lineDiscount(line())).toBe('0');
  });

  it('keeps fractional quantities exact', () => {
    expect(lineTotal(line({ quantity: '2.5', unitPrice: '1.50' }))).toBe('3.75');
  });

  it('applies a fixed discount and a percentage discount', () => {
    expect(applyDiscount('100', 'AMOUNT', '10')).toBe('10');
    expect(applyDiscount('100', 'PERCENT', '10')).toBe('10');
    expect(applyDiscount('99.99', 'PERCENT', '12.5')).toBe('12.5');
  });

  it('never discounts more than the amount it discounts', () => {
    expect(applyDiscount('50', 'AMOUNT', '80')).toBe('50');
    expect(applyDiscount('50', 'PERCENT', '150')).toBe('50');
  });

  it('ignores an empty discount', () => {
    expect(applyDiscount('50', null, '')).toBe('0');
    expect(applyDiscount('50', 'AMOUNT', '')).toBe('0');
  });

  it('applies the line discount to the line total', () => {
    const discounted = line({ discountType: 'PERCENT', discountValue: '10' });

    expect(lineDiscount(discounted)).toBe('28.8');
    expect(lineTotal(discounted)).toBe('259.2');
  });

  it('adds the line totals and applies the invoice discount', () => {
    const lines = [line(), line({ quantity: '1', unitPrice: '12.00' })];

    expect(draftSubtotal(lines)).toBe('300');

    const totals = draftTotals(lines, 'PERCENT', '10');

    expect(totals.subtotal).toBe('300');
    expect(totals.discountTotal).toBe('30');
    expect(totals.total).toBe('270');
  });

  it('converts a quantity into the base unit of the product', () => {
    expect(lineBaseQuantity(line())).toBe('288');
    expect(lineBaseQuantity(line({ quantity: '2.5' }))).toBe('60');
  });

  it('counts only the batches that are not expired', () => {
    const batches = [
      { quantity: '100', expiryDate: '2027-01-31' },
      { quantity: '50', expiryDate: '2026-01-01' },
      { quantity: '25', expiryDate: null },
    ];

    expect(usableBatchQuantity(batches, '2026-10-21')).toBe('125');
  });

  it('compares and subtracts decimal strings', () => {
    expect(compareDecimals('10', '9.99')).toBe(1);
    expect(compareDecimals('10.00', '10')).toBe(0);
    expect(compareDecimals('9.99', '10')).toBe(-1);
    expect(subtractDecimals('10.50', '0.25')).toBe('10.25');
  });
});

describe('idempotency key handling', () => {
  it('creates a new key for a new attempt', () => {
    const key = newIdempotencyKey();

    expect(key.length).toBeGreaterThan(8);
    expect(keyForAttempt(key, false)).not.toBe(key);
  });

  it('keeps the key of a failed attempt so a retry cannot write a second invoice', () => {
    const key = newIdempotencyKey();

    expect(keyForAttempt(key, true)).toBe(key);
  });

  it('creates a key when there is none yet', () => {
    expect(keyForAttempt(null, true).length).toBeGreaterThan(8);
  });
});
