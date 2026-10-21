import {
  draftLineTotal,
  draftTotal,
  emptyLineDraft,
  hasErrors,
  validateLineDraft,
  type PurchaseLineDraft,
} from '@/features/purchases/purchase-drafts';
import type { Product, ProductUnit } from '@/lib/types';

const BASE_UNIT: ProductUnit = {
  id: 'unit-base',
  name: 'bottle',
  conversionFactor: '1',
  isBaseUnit: true,
  isActive: true,
  prices: [],
};

const CARTON: ProductUnit = {
  id: 'unit-carton',
  name: 'carton',
  conversionFactor: '24',
  isBaseUnit: false,
  isActive: true,
  prices: [],
};

const PRODUCT: Product = {
  id: 'product-1',
  sku: 'BEER-001',
  name: 'ABC Beer 330ml',
  description: null,
  category: null,
  reorderLevel: '120',
  costPrice: '1',
  trackBatches: false,
  isActive: true,
  baseUnit: BASE_UNIT,
  units: [BASE_UNIT, CARTON],
  currentStock: '0',
  currentStockReadable: '0 bottles',
  lowStock: true,
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-21T09:00:00.000Z',
};

const TRACKED_PRODUCT: Product = { ...PRODUCT, id: 'product-2', trackBatches: true };

const t = (key: string, params?: Record<string, string | number>): string => {
  if (params === undefined) {
    return key;
  }

  return `${key}:${Object.values(params).join(',')}`;
};

function line(overrides: Partial<PurchaseLineDraft> = {}): PurchaseLineDraft {
  return { ...emptyLineDraft(), ...overrides };
}

describe('purchase drafts', () => {
  it('calculates a line total with decimal arithmetic', () => {
    expect(draftLineTotal(line({ quantity: '12', unitCost: '24.00' }))).toBe('288');
    expect(draftLineTotal(line({ quantity: '2.5', unitCost: '1.50' }))).toBe('3.75');
    expect(draftLineTotal(line({ quantity: '12', unitCost: '' }))).toBeNull();
  });

  it('adds every line into the purchase total', () => {
    const drafts = [
      line({ quantity: '12', unitCost: '24.00' }),
      line({ quantity: '2.5', unitCost: '1.50' }),
    ];

    expect(draftTotal(drafts)).toBe('291.75');
    expect(draftTotal([line({ quantity: '1', unitCost: '1.00' })])).toBe('1');
    expect(draftTotal([line({ quantity: '', unitCost: '1.00' })])).toBeNull();
  });

  it('requires a product, unit, quantity, and cost', () => {
    const errors = validateLineDraft(line(), { product: null, units: [], trackBatches: false }, t);

    expect(errors.productId).toBeDefined();
    expect(errors.unitId).toBeDefined();
    expect(errors.quantity).toBeDefined();
    expect(errors.unitCost).toBeDefined();
    expect(hasErrors(errors)).toBe(true);
  });

  it('rejects a zero or negative quantity and an invalid cost', () => {
    const errors = validateLineDraft(
      line({ productId: 'product-1', unitId: 'unit-carton', quantity: '0', unitCost: '1.555' }),
      { product: PRODUCT, units: [BASE_UNIT, CARTON], trackBatches: false },
      t,
    );

    expect(errors.quantity).toBeDefined();
    expect(errors.unitCost).toBeDefined();
  });

  it('requires a batch number and expiry date for batch-tracked products', () => {
    const missing = validateLineDraft(
      line({ productId: 'product-2', unitId: 'unit-carton', quantity: '1', unitCost: '1.00' }),
      { product: TRACKED_PRODUCT, units: [BASE_UNIT, CARTON], trackBatches: true },
      t,
    );

    expect(missing.batchNumber).toBeDefined();
    expect(missing.expiryDate).toBeDefined();

    const complete = validateLineDraft(
      line({
        productId: 'product-2',
        unitId: 'unit-carton',
        quantity: '1',
        unitCost: '1.00',
        batchNumber: 'LOT-1',
        expiryDate: '2027-01-31',
      }),
      { product: TRACKED_PRODUCT, units: [BASE_UNIT, CARTON], trackBatches: true },
      t,
    );

    expect(complete.batchNumber).toBeUndefined();
    expect(complete.expiryDate).toBeUndefined();
    expect(hasErrors(complete)).toBe(false);
  });

  it('does not ask for a batch for products without batch tracking', () => {
    const errors = validateLineDraft(
      line({ productId: 'product-1', unitId: 'unit-carton', quantity: '1', unitCost: '1.00' }),
      { product: PRODUCT, units: [BASE_UNIT, CARTON], trackBatches: false },
      t,
    );

    expect(errors.batchNumber).toBeUndefined();
    expect(errors.expiryDate).toBeUndefined();
    expect(hasErrors(errors)).toBe(false);
  });
});
