/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { I18nProvider } from '@/components/i18n-provider';
import { PurchasesManager } from '@/features/purchases/purchases-manager';
import {
  cancelPurchase,
  getDepotSettings,
  listProducts,
  listPurchases,
  listSuppliers,
  receivePurchase,
} from '@/lib/api-client';
import type { Paginated, Product, Purchase, Supplier } from '@/lib/types';

jest.mock('@/lib/api-client', () => ({
  listPurchases: jest.fn(),
  listSuppliers: jest.fn(),
  listProducts: jest.fn(),
  getDepotSettings: jest.fn(),
  createPurchase: jest.fn(),
  updatePurchase: jest.fn(),
  receivePurchase: jest.fn(),
  cancelPurchase: jest.fn(),
}));

const listPurchasesMock = listPurchases as jest.MockedFunction<typeof listPurchases>;
const listSuppliersMock = listSuppliers as jest.MockedFunction<typeof listSuppliers>;
const listProductsMock = listProducts as jest.MockedFunction<typeof listProducts>;
const settingsMock = getDepotSettings as jest.MockedFunction<typeof getDepotSettings>;
const receiveMock = receivePurchase as jest.MockedFunction<typeof receivePurchase>;
const cancelMock = cancelPurchase as jest.MockedFunction<typeof cancelPurchase>;

const SUPPLIER: Supplier = {
  id: 'supplier-1',
  name: 'Phnom Penh Beverages',
  contactName: null,
  phone: '+85512345678',
  email: null,
  address: null,
  notes: null,
  isActive: true,
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-01T08:00:00.000Z',
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
  baseUnit: {
    id: 'unit-base',
    name: 'bottle',
    conversionFactor: '1',
    isBaseUnit: true,
    isActive: true,
    prices: [],
  },
  units: [],
  currentStock: '0',
  currentStockReadable: '0 bottles',
  lowStock: true,
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-21T09:00:00.000Z',
};

function purchase(overrides: Partial<Purchase>): Purchase {
  return {
    id: 'purchase-1',
    referenceNumber: 'PO-20261021-ABC12345',
    status: 'DRAFT',
    supplier: {
      id: SUPPLIER.id,
      name: SUPPLIER.name,
      phone: SUPPLIER.phone,
      email: null,
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
    items: [
      {
        id: 'item-1',
        productId: PRODUCT.id,
        productSku: PRODUCT.sku,
        productName: PRODUCT.name,
        productUnitId: 'unit-base',
        productUnitName: 'bottle',
        quantity: '12',
        quantityBase: '12',
        unitCost: '24.00',
        unitCostPerBaseUnit: '24.00',
        lineTotal: '288.00',
        batchNumber: null,
        expiryDate: null,
      },
    ],
    createdAt: '2026-10-21T09:00:00.000Z',
    updatedAt: '2026-10-21T09:00:00.000Z',
    ...overrides,
  };
}

function page(data: Purchase[]): Paginated<Purchase> {
  return { data, meta: { page: 1, pageSize: 20, total: data.length } };
}

function renderManager() {
  return render(
    <I18nProvider initialLocale="en">
      <PurchasesManager />
    </I18nProvider>,
  );
}

describe('PurchasesManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listPurchasesMock.mockResolvedValue(page([purchase({})]));
    listSuppliersMock.mockResolvedValue({
      data: [SUPPLIER],
      meta: { page: 1, pageSize: 100, total: 1 },
    });
    listProductsMock.mockResolvedValue({
      data: [PRODUCT],
      meta: { page: 1, pageSize: 100, total: 1 },
    });
    settingsMock.mockResolvedValue({
      id: 'depot-1',
      name: 'Depot A',
      address: null,
      currency: 'KHR',
      locale: 'EN',
      invoiceFooter: null,
      logoKey: null,
    });
    receiveMock.mockResolvedValue(
      purchase({ status: 'RECEIVED', receivedAt: '2026-10-21T10:00:00.000Z' }),
    );
    cancelMock.mockResolvedValue(purchase({ status: 'CANCELLED' }));
  });

  it('shows draft actions and keeps received purchases read-only', async () => {
    renderManager();

    expect(await screen.findByText('PO-20261021-ABC12345')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Receive' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    listPurchasesMock.mockResolvedValue(
      page([
        purchase({
          id: 'purchase-2',
          referenceNumber: 'PO-20261021-DEF67890',
          status: 'RECEIVED',
          receivedAt: '2026-10-21T10:00:00.000Z',
        }),
      ]),
    );
  });

  it('confirms receiving a purchase before it is sent to the API', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(await screen.findByRole('button', { name: 'Receive' }));

    expect(await screen.findByText('Receive this purchase?')).toBeInTheDocument();
    expect(receiveMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Receive purchase' }));

    await waitFor(() => {
      expect(receiveMock).toHaveBeenCalledWith('purchase-1');
    });
  });

  it('asks for a reason when cancelling a draft purchase', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Cancel this purchase?')).toBeInTheDocument();

    await user.type(
      screen.getByLabelText('Reason for cancelling (required)'),
      'Supplier could not deliver',
    );
    await user.click(screen.getByRole('button', { name: 'Cancel purchase' }));

    await waitFor(() => {
      expect(cancelMock).toHaveBeenCalledWith('purchase-1', 'Supplier could not deliver');
    });
  });

  it('filters the list by status', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.selectOptions(await screen.findByLabelText('Status'), 'RECEIVED');

    await waitFor(() => {
      expect(listPurchasesMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'RECEIVED' }),
      );
    });
  });
});
