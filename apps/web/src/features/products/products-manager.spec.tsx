/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { I18nProvider } from '@/components/i18n-provider';
import { ProductsManager } from '@/features/products/products-manager';
import { getDepotSettings, listCategories, listProducts } from '@/lib/api-client';
import type {
  DepotSettings,
  Paginated,
  Product,
  ProductUnit,
  SessionUser,
  UserRole,
} from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';

jest.mock('@/lib/api-client', () => ({
  listProducts: jest.fn(),
  listCategories: jest.fn(),
  getDepotSettings: jest.fn(),
  getProduct: jest.fn(),
  archiveProduct: jest.fn(),
  createProduct: jest.fn(),
  updateProduct: jest.fn(),
  createProductUnit: jest.fn(),
  updateProductUnit: jest.fn(),
  archiveProductUnit: jest.fn(),
  setProductPrice: jest.fn(),
}));

const listProductsMock = listProducts as jest.MockedFunction<typeof listProducts>;
const listCategoriesMock = listCategories as jest.MockedFunction<typeof listCategories>;
const settingsMock = getDepotSettings as jest.MockedFunction<typeof getDepotSettings>;

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
  units: [
    BASE_UNIT,
    {
      id: 'unit-carton',
      name: 'carton',
      conversionFactor: '24',
      isBaseUnit: false,
      isActive: true,
      prices: [],
    },
  ],
  currentStock: '50',
  currentStockReadable: '2 cartons and 2 bottles',
  lowStock: true,
  costPrice: '1.20',
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-21T09:00:00.000Z',
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

const PAGE: Paginated<Product> = {
  data: [PRODUCT],
  meta: { page: 1, pageSize: 10, total: 1 },
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

function renderManager(role: UserRole, locale: 'en' | 'km' = 'en') {
  setRole(role);

  return render(
    <I18nProvider initialLocale={locale}>
      <ProductsManager />
    </I18nProvider>,
  );
}

describe('ProductsManager role-based catalog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listProductsMock.mockResolvedValue(PAGE);
    listCategoriesMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 100, total: 0 },
    });
    settingsMock.mockResolvedValue(SETTINGS);
  });

  it('shows prices and low stock to sales without management actions', async () => {
    renderManager('SALES');

    expect(await screen.findByText('ABC Beer 330ml')).toBeInTheDocument();
    expect(screen.getAllByText('1.50 KHR').length).toBeGreaterThan(0);
    expect(screen.getByText('Low stock')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add product' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
    expect(listCategoriesMock).not.toHaveBeenCalled();
  });

  it('shows management actions to the owner', async () => {
    renderManager('OWNER');

    expect(await screen.findByText('ABC Beer 330ml')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add product' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
    expect(listCategoriesMock).toHaveBeenCalled();
  });

  it('renders the catalog and low-stock marker in Khmer', async () => {
    renderManager('SALES', 'km');

    expect(await screen.findByText('ABC Beer 330ml')).toBeInTheDocument();
    expect(screen.getAllByText('ផលិតផល').length).toBeGreaterThan(0);
    expect(screen.getByText('ស្តុកទាប')).toBeInTheDocument();
    expect(screen.getAllByText('1.50 KHR').length).toBeGreaterThan(0);
  });
});
