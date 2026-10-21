/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { I18nProvider } from '@/components/i18n-provider';
import { StockManager } from '@/features/stock/stock-manager';
import { ApiError } from '@/lib/api-error';
import {
  createStockAdjustment,
  getBatchAlerts,
  listLowStock,
  listProducts,
  listStock,
  listStockMovements,
} from '@/lib/api-client';
import type { Paginated, Product, SessionUser, StockItem, UserRole } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';

jest.mock('@/lib/api-client', () => ({
  listStock: jest.fn(),
  listLowStock: jest.fn(),
  listProducts: jest.fn(),
  listStockMovements: jest.fn(),
  getBatchAlerts: jest.fn(),
  createStockAdjustment: jest.fn(),
  createStockDamage: jest.fn(),
}));

const listStockMock = listStock as jest.MockedFunction<typeof listStock>;
const listLowStockMock = listLowStock as jest.MockedFunction<typeof listLowStock>;
const listProductsMock = listProducts as jest.MockedFunction<typeof listProducts>;
const listMovementsMock = listStockMovements as jest.MockedFunction<typeof listStockMovements>;
const batchAlertsMock = getBatchAlerts as jest.MockedFunction<typeof getBatchAlerts>;
const adjustmentMock = createStockAdjustment as jest.MockedFunction<typeof createStockAdjustment>;

const BASE_UNIT = {
  id: 'unit-base',
  name: 'bottle',
  conversionFactor: '1',
  isBaseUnit: true,
  isActive: true,
  prices: [],
};

const CARTON = {
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
  currentStock: '50',
  currentStockReadable: '2 cartons and 2 bottles',
  lowStock: true,
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-21T09:00:00.000Z',
};

const STOCK_ITEM: StockItem = {
  id: PRODUCT.id,
  sku: PRODUCT.sku,
  name: PRODUCT.name,
  description: null,
  category: null,
  reorderLevel: '120',
  costPrice: '1',
  trackBatches: false,
  isActive: true,
  baseUnit: BASE_UNIT,
  units: [BASE_UNIT, CARTON],
  currentStock: '50',
  currentStockReadable: '2 cartons and 2 bottles',
  lowStock: true,
  batches: [],
};

const STOCK_PAGE: Paginated<StockItem> = {
  data: [STOCK_ITEM],
  meta: { page: 1, pageSize: 20, total: 1 },
};

const MOVEMENT_PAGE: Paginated<import('@/lib/types').StockMovement> = {
  data: [
    {
      id: 'movement-1',
      type: 'ADJUSTMENT',
      quantity: '-2',
      quantityReadable: '-2 bottles',
      unitCost: null,
      reason: 'Physical count correction',
      product: { id: PRODUCT.id, sku: PRODUCT.sku, name: PRODUCT.name },
      batch: null,
      createdBy: { id: 'user-1', name: 'Dara Sok' },
      saleOrderId: null,
      purchaseOrderId: null,
      createdAt: '2026-10-21T09:00:00.000Z',
    },
  ],
  meta: { page: 1, pageSize: 20, total: 1 },
};

function setRole(role: UserRole) {
  const user: SessionUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'user@example.com',
    phone: null,
    role,
    depotId: role === 'PLATFORM_ADMIN' ? null : 'depot-1',
    mustChangePassword: false,
  };

  useSessionStore.setState({
    user,
    role,
    depot: { id: 'depot-1', name: 'Depot A', status: 'APPROVED' },
    accessToken: 'access-token',
    status: 'authenticated',
    logoutReason: null,
  });
}

function renderManager(role: UserRole) {
  setRole(role);

  return render(
    <I18nProvider initialLocale="en">
      <StockManager />
    </I18nProvider>,
  );
}

describe('StockManager role-based screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listStockMock.mockResolvedValue(STOCK_PAGE);
    listLowStockMock.mockResolvedValue(STOCK_PAGE);
    listProductsMock.mockResolvedValue({
      data: [PRODUCT],
      meta: { page: 1, pageSize: 100, total: 1 },
    });
    listMovementsMock.mockResolvedValue(MOVEMENT_PAGE);
    batchAlertsMock.mockResolvedValue({ days: 30, nearExpiry: [], expired: [] });
    adjustmentMock.mockResolvedValue({
      movementId: 'movement-2',
      type: 'ADJUSTMENT',
      quantity: '-2',
      quantityReadable: '-2 bottles',
      stockAfter: '48',
      stockAfterReadable: '2 cartons',
    });
  });

  it('lets sales read the stock without management forms', async () => {
    renderManager('SALES');

    expect((await screen.findAllByText('ABC Beer 330ml')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('2 cartons and 2 bottles').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Low stock').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Your role can read stock but cannot record adjustments or damage.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record adjustment' })).not.toBeInTheDocument();
  });

  it('shows the movement history with who changed the stock and why', async () => {
    renderManager('SALES');

    expect(await screen.findByText('Dara Sok')).toBeInTheDocument();
    expect(screen.getByText('Physical count correction')).toBeInTheDocument();
    expect(screen.getAllByText('Adjustment').length).toBeGreaterThan(0);
  });

  it('shows the adjustment form to the stock keeper', async () => {
    renderManager('STOCK_KEEPER');

    expect(await screen.findByRole('button', { name: 'Record adjustment' })).toBeInTheDocument();
    expect(screen.getByLabelText('Reason (required)')).toBeInTheDocument();
  });

  it('shows the API message when a movement would make stock negative', async () => {
    const user = userEvent.setup();
    adjustmentMock.mockRejectedValue(
      new ApiError('Insufficient stock: available 10, requested 20', 400),
    );
    renderManager('STOCK_KEEPER');

    await user.selectOptions(await screen.findByLabelText('Product'), PRODUCT.id);
    await user.selectOptions(screen.getByLabelText('Unit'), BASE_UNIT.id);
    await user.type(screen.getByLabelText('Quantity'), '-20');
    await user.type(screen.getByLabelText('Reason (required)'), 'Physical count correction');
    await user.click(screen.getByRole('button', { name: 'Record adjustment' }));

    expect(
      await screen.findByText('There is not enough stock for this movement.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Insufficient stock: available 10, requested 20')).toBeInTheDocument();
  });

  it('keeps the low-stock filter and the batch alert threshold', async () => {
    const user = userEvent.setup();
    renderManager('SALES');

    await user.click(await screen.findByRole('button', { name: 'Low stock' }));

    await waitFor(() => {
      expect(listLowStockMock).toHaveBeenCalled();
    });

    expect(screen.getByLabelText('Alert threshold')).toBeInTheDocument();
  });
});
