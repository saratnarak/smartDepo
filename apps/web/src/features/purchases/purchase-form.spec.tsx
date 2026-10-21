/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { I18nProvider } from '@/components/i18n-provider';
import { PurchaseForm } from '@/features/purchases/purchase-form';
import { createPurchase } from '@/lib/api-client';
import type { Product, ProductUnit, Purchase, Supplier } from '@/lib/types';

jest.mock('@/lib/api-client', () => ({
  createPurchase: jest.fn(),
  updatePurchase: jest.fn(),
}));

const createPurchaseMock = createPurchase as jest.MockedFunction<typeof createPurchase>;

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

const TRACKED_PRODUCT: Product = {
  ...PRODUCT,
  id: 'product-2',
  sku: 'RICE-001',
  name: 'Tracked Rice',
  trackBatches: true,
};

const SUPPLIER: Supplier = {
  id: 'supplier-1',
  name: 'Phnom Penh Beverages',
  contactName: 'Sopheak Chan',
  phone: '+85512345678',
  email: 'supplier@example.com',
  address: null,
  notes: null,
  isActive: true,
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-01T08:00:00.000Z',
};

const SAVED: Purchase = {
  id: 'purchase-1',
  referenceNumber: 'PO-20261021-ABC12345',
  status: 'DRAFT',
  supplier: {
    id: SUPPLIER.id,
    name: SUPPLIER.name,
    phone: SUPPLIER.phone,
    email: SUPPLIER.email,
    address: null,
    isActive: true,
  },
  subtotal: '288.00',
  discountTotal: '0.00',
  total: '288.00',
  orderedAt: null,
  receivedAt: null,
  notes: null,
  createdBy: { id: 'user-1', name: 'Dara Sok' },
  items: [],
  createdAt: '2026-10-21T09:00:00.000Z',
  updatedAt: '2026-10-21T09:00:00.000Z',
};

function renderForm() {
  const onSaved = jest.fn();
  const onCancel = jest.fn();

  render(
    <I18nProvider initialLocale="en">
      <PurchaseForm
        purchase={null}
        suppliers={[SUPPLIER]}
        products={[PRODUCT, TRACKED_PRODUCT]}
        onSaved={onSaved}
        onCancel={onCancel}
      />
    </I18nProvider>,
  );

  return { onSaved, onCancel };
}

describe('PurchaseForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createPurchaseMock.mockResolvedValue(SAVED);
  });

  it('calculates the line total and the purchase total while typing', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(screen.getByLabelText('Product'), PRODUCT.id);
    await user.selectOptions(screen.getByLabelText('Unit'), CARTON.id);
    await user.type(screen.getByLabelText('Quantity'), '12');
    await user.type(screen.getByLabelText('Unit cost'), '24.00');

    expect((await screen.findAllByText('288.00')).length).toBe(2);
    expect(screen.getByText('Base unit cost: 1')).toBeInTheDocument();
  });

  it('creates a draft purchase with the entered line', async () => {
    const user = userEvent.setup();
    const { onSaved } = renderForm();

    await user.selectOptions(screen.getByLabelText('Supplier'), SUPPLIER.id);
    await user.selectOptions(screen.getByLabelText('Product'), PRODUCT.id);
    await user.selectOptions(screen.getByLabelText('Unit'), CARTON.id);
    await user.type(screen.getByLabelText('Quantity'), '12');
    await user.type(screen.getByLabelText('Unit cost'), '24.00');
    await user.click(screen.getByRole('button', { name: 'Create draft' }));

    await waitFor(() => {
      expect(createPurchaseMock).toHaveBeenCalledWith({
        supplierId: SUPPLIER.id,
        notes: null,
        lines: [
          {
            productId: PRODUCT.id,
            unitId: CARTON.id,
            quantity: '12',
            unitCost: '24.00',
            batchNumber: null,
            expiryDate: null,
          },
        ],
      });
    });

    expect(onSaved).toHaveBeenCalledWith(SAVED);
  });

  it('asks for a batch number and expiry date on batch-tracked products', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(screen.getByLabelText('Supplier'), SUPPLIER.id);
    await user.selectOptions(screen.getByLabelText('Product'), TRACKED_PRODUCT.id);
    await user.selectOptions(screen.getByLabelText('Unit'), CARTON.id);
    await user.type(screen.getByLabelText('Quantity'), '1');
    await user.type(screen.getByLabelText('Unit cost'), '24.00');
    await user.click(screen.getByRole('button', { name: 'Create draft' }));

    expect(createPurchaseMock).not.toHaveBeenCalled();
    expect(await screen.findAllByText('This field is required.')).toHaveLength(2);

    await user.type(screen.getByLabelText('Batch number'), 'LOT-2026-01');
    await user.type(screen.getByLabelText('Expiry date'), '2027-01-31');
    await user.click(screen.getByRole('button', { name: 'Create draft' }));

    await waitFor(() => {
      expect(createPurchaseMock).toHaveBeenCalledWith({
        supplierId: SUPPLIER.id,
        notes: null,
        lines: [
          {
            productId: TRACKED_PRODUCT.id,
            unitId: CARTON.id,
            quantity: '1',
            unitCost: '24.00',
            batchNumber: 'LOT-2026-01',
            expiryDate: '2027-01-31',
          },
        ],
      });
    });
  });
});
