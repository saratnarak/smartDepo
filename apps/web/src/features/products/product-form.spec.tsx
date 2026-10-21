/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { I18nProvider } from '@/components/i18n-provider';
import { ProductForm } from '@/features/products/product-form';
import { createProduct, updateProduct } from '@/lib/api-client';
import type { Category, Product, ProductUnit, SessionUser, UserRole } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';

jest.mock('@/lib/api-client', () => ({
  createProduct: jest.fn(),
  updateProduct: jest.fn(),
  createProductUnit: jest.fn(),
  updateProductUnit: jest.fn(),
  archiveProductUnit: jest.fn(),
  setProductPrice: jest.fn(),
}));

jest.mock('@/components/image-upload', () => ({
  ImageUpload: ({ label }: { label: string }) => <div>{label}</div>,
}));

const createMock = createProduct as jest.MockedFunction<typeof createProduct>;
const updateMock = updateProduct as jest.MockedFunction<typeof updateProduct>;

const CATEGORY: Category = {
  id: 'category-1',
  name: 'Beer',
  isActive: true,
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-01T08:00:00.000Z',
};

const BASE_UNIT: ProductUnit = {
  id: 'unit-base',
  name: 'bottle',
  conversionFactor: '1',
  isBaseUnit: true,
  isActive: true,
  prices: [
    {
      id: 'price-1',
      type: 'RETAIL',
      amount: '1.50',
      updatedAt: '2026-10-21T09:00:00.000Z',
    },
  ],
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
  category: { id: 'category-1', name: 'Beer', isActive: true },
  reorderLevel: '120.000',
  trackBatches: false,
  isActive: true,
  baseUnit: BASE_UNIT,
  units: [BASE_UNIT, CARTON],
  costPrice: '1.20',
  currentStock: '50',
  currentStockReadable: '2 cartons and 2 bottles',
  lowStock: true,
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-21T09:00:00.000Z',
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

function renderForm(product: Product | null = null) {
  const onSaved = jest.fn();
  const onCancel = jest.fn();
  const onRefresh = jest.fn().mockResolvedValue(null);
  const onNotify = jest.fn();

  render(
    <I18nProvider initialLocale="en">
      <ProductForm
        product={product}
        categories={[CATEGORY]}
        currency="KHR"
        onSaved={onSaved}
        onCancel={onCancel}
        onRefresh={onRefresh}
        onNotify={onNotify}
      />
    </I18nProvider>,
  );

  return { onSaved, onCancel, onRefresh, onNotify };
}

describe('ProductForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setRole('OWNER');
  });

  it('creates a product with its base unit and extra unit conversion', async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValue(PRODUCT);
    const { onSaved } = renderForm();

    await user.type(screen.getByLabelText('Product name'), 'ABC Beer');
    await user.type(screen.getByLabelText('SKU'), 'beer-001');
    await user.selectOptions(screen.getByLabelText('Category'), 'category-1');
    const reorder = screen.getByLabelText('Reorder level (base units)');
    await user.clear(reorder);
    await user.type(reorder, '120');
    await user.type(screen.getByLabelText('Base unit'), 'bottle');
    await user.click(screen.getByRole('button', { name: 'Add unit' }));
    await user.type(screen.getByLabelText('Unit name'), 'carton');
    await user.type(screen.getByLabelText('Factor'), '24');

    expect(screen.getByText('1 carton = 24 bottles')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create product' }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({
        sku: 'BEER-001',
        name: 'ABC Beer',
        description: null,
        categoryId: 'category-1',
        reorderLevel: '120',
        trackBatches: false,
        baseUnit: 'bottle',
        units: [{ name: 'carton', conversionFactor: '24' }],
      });
      expect(onSaved).toHaveBeenCalledWith(PRODUCT);
    });
  });

  it('validates the product fields and the base unit before creating', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Create product' }));

    expect(await screen.findAllByText('This field is required.')).toHaveLength(3);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects a duplicate extra-unit name', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Product name'), 'ABC Beer');
    await user.type(screen.getByLabelText('SKU'), 'BEER-001');
    await user.type(screen.getByLabelText('Base unit'), 'bottle');
    await user.click(screen.getByRole('button', { name: 'Add unit' }));
    await user.type(screen.getByLabelText('Unit name'), 'Bottle');
    await user.type(screen.getByLabelText('Factor'), '24');
    await user.click(screen.getByRole('button', { name: 'Create product' }));

    expect(
      await screen.findByText('Unit names must be unique for this product.'),
    ).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('updates an existing product', async () => {
    const user = userEvent.setup();
    const updated = { ...PRODUCT, name: 'ABC Beer Updated' };
    updateMock.mockResolvedValue(updated);
    const { onSaved } = renderForm(PRODUCT);

    const name = screen.getByLabelText('Product name');
    await user.clear(name);
    await user.type(name, 'ABC Beer Updated');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith('product-1', {
        sku: 'BEER-001',
        name: 'ABC Beer Updated',
        description: null,
        categoryId: 'category-1',
        reorderLevel: '120.000',
        trackBatches: false,
      });
      expect(onSaved).toHaveBeenCalledWith(updated);
    });
  });

  it('lets the owner edit prices in the product form', () => {
    renderForm(PRODUCT);

    expect(screen.getByLabelText('Retail price for 1 bottle')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Save price' }).length).toBeGreaterThan(0);
  });

  it('shows prices read-only to the stock keeper', () => {
    setRole('STOCK_KEEPER');
    renderForm(PRODUCT);

    expect(screen.queryByLabelText('Retail price for 1 bottle')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save price' })).not.toBeInTheDocument();
    expect(screen.getAllByText('1.50 KHR').length).toBeGreaterThan(0);
  });
});
