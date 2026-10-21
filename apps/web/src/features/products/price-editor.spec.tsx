/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { I18nProvider } from '@/components/i18n-provider';
import { PriceEditor } from '@/features/products/price-editor';
import { listPriceHistory, setProductPrice } from '@/lib/api-client';
import type { Product } from '@/lib/types';

jest.mock('@/lib/api-client', () => ({
  setProductPrice: jest.fn(),
  listPriceHistory: jest.fn(),
}));

const setPriceMock = setProductPrice as jest.MockedFunction<typeof setProductPrice>;
const listPriceHistoryMock = listPriceHistory as jest.MockedFunction<typeof listPriceHistory>;

const PRODUCT: Product = {
  id: 'product-1',
  sku: 'BEER-001',
  name: 'ABC Beer 330ml',
  description: null,
  category: { id: 'category-1', name: 'Beer', isActive: true },
  reorderLevel: '120.000',
  costPrice: '1.20',
  trackBatches: false,
  isActive: true,
  baseUnit: {
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
  },
  units: [],
  currentStock: '50',
  currentStockReadable: '2 cartons and 2 bottles',
  lowStock: true,
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-21T09:00:00.000Z',
};

PRODUCT.units = [
  PRODUCT.baseUnit,
  {
    id: 'unit-carton',
    name: 'carton',
    conversionFactor: '24',
    isBaseUnit: false,
    isActive: true,
    prices: [],
  },
];

function renderEditor(canEdit: boolean) {
  const onChanged = jest.fn().mockResolvedValue(undefined);
  const onNotify = jest.fn();

  render(
    <I18nProvider initialLocale="en">
      <PriceEditor
        product={PRODUCT}
        currency="KHR"
        canEdit={canEdit}
        onChanged={onChanged}
        onNotify={onNotify}
      />
    </I18nProvider>,
  );

  return { onChanged, onNotify };
}

describe('PriceEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listPriceHistoryMock.mockResolvedValue({
      data: [
        {
          id: 'history-1',
          productId: 'product-1',
          productUnitId: 'unit-base',
          productUnitName: 'bottle',
          type: 'RETAIL',
          oldAmount: '1.40',
          newAmount: '1.50',
          changedBy: { id: 'user-1', name: 'Dara Sok' },
          createdAt: '2026-10-21T09:00:00.000Z',
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1 },
    });
  });

  it('lets the owner edit and save a price per unit', async () => {
    const user = userEvent.setup();
    setPriceMock.mockResolvedValue({
      id: 'price-1',
      type: 'RETAIL',
      amount: '2.00',
      updatedAt: '2026-10-21T10:00:00.000Z',
    });
    const { onChanged, onNotify } = renderEditor(true);

    const input = screen.getByLabelText('Retail price for 1 bottle');
    expect(input).toHaveValue('1.50');

    await user.clear(input);
    await user.type(input, '2.00');
    await user.click(screen.getAllByRole('button', { name: 'Save price' })[0]);

    await waitFor(() => {
      expect(setPriceMock).toHaveBeenCalledWith('product-1', 'unit-base', 'RETAIL', '2.00');
      expect(onChanged).toHaveBeenCalled();
      expect(onNotify).toHaveBeenCalledWith('The price was updated.');
    });
  });

  it('shows prices read-only when the role cannot change them', () => {
    renderEditor(false);

    expect(screen.queryByLabelText('Retail price for 1 bottle')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save price' })).not.toBeInTheDocument();
    expect(screen.getAllByText('1.50 KHR').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Your role can view products and prices but cannot change them.'),
    ).toBeInTheDocument();
  });

  it('shows the price history with the old and new amount, who changed it, and when', async () => {
    renderEditor(false);

    expect((await screen.findAllByText('Dara Sok')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('1.40 KHR').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1.50 KHR').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/21 Oct 2026/).length).toBeGreaterThan(0);
    expect(listPriceHistoryMock).toHaveBeenCalledWith('product-1', 'unit-base', { pageSize: 50 });
  });

  it('rejects an amount with more than two decimals', async () => {
    const user = userEvent.setup();
    renderEditor(true);

    const input = screen.getByLabelText('Retail price for 1 bottle');
    await user.clear(input);
    await user.type(input, '1.555');
    await user.click(screen.getAllByRole('button', { name: 'Save price' })[0]);

    expect(setPriceMock).not.toHaveBeenCalled();
    expect(screen.getByText('Enter an amount with up to 2 decimals.')).toBeInTheDocument();
  });
});
