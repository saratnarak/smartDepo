/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { I18nProvider } from '@/components/i18n-provider';
import { SuppliersManager } from '@/features/suppliers/suppliers-manager';
import { archiveSupplier, createSupplier, listSuppliers, updateSupplier } from '@/lib/api-client';
import type { Paginated, Supplier } from '@/lib/types';

jest.mock('@/lib/api-client', () => ({
  listSuppliers: jest.fn(),
  createSupplier: jest.fn(),
  updateSupplier: jest.fn(),
  archiveSupplier: jest.fn(),
}));

const listSuppliersMock = listSuppliers as jest.MockedFunction<typeof listSuppliers>;
const createSupplierMock = createSupplier as jest.MockedFunction<typeof createSupplier>;
const updateSupplierMock = updateSupplier as jest.MockedFunction<typeof updateSupplier>;
const archiveSupplierMock = archiveSupplier as jest.MockedFunction<typeof archiveSupplier>;

const SUPPLIER: Supplier = {
  id: 'supplier-1',
  name: 'Phnom Penh Beverages',
  contactName: 'Sopheak Chan',
  phone: '+85512345678',
  email: 'supplier@example.com',
  address: 'Street 271',
  notes: 'Delivers on Monday',
  isActive: true,
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-01T08:00:00.000Z',
};

const PAGE: Paginated<Supplier> = {
  data: [SUPPLIER],
  meta: { page: 1, pageSize: 20, total: 1 },
};

function renderManager() {
  return render(
    <I18nProvider initialLocale="en">
      <SuppliersManager />
    </I18nProvider>,
  );
}

describe('SuppliersManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listSuppliersMock.mockResolvedValue(PAGE);
    createSupplierMock.mockResolvedValue(SUPPLIER);
    updateSupplierMock.mockResolvedValue(SUPPLIER);
    archiveSupplierMock.mockResolvedValue({ ...SUPPLIER, isActive: false });
  });

  it('creates a supplier with the entered details', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(await screen.findByRole('button', { name: 'Add supplier' }));
    await user.type(screen.getByLabelText('Supplier name'), 'Phnom Penh Beverages');
    await user.type(screen.getByLabelText('Phone'), '+85512345678');
    await user.click(screen.getByRole('button', { name: 'Create supplier' }));

    await waitFor(() => {
      expect(createSupplierMock).toHaveBeenCalledWith({
        name: 'Phnom Penh Beverages',
        contactName: null,
        phone: '+85512345678',
        email: null,
        address: null,
        notes: null,
      });
    });
  });

  it('edits an existing supplier', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('Contact name'));
    await user.type(screen.getByLabelText('Contact name'), 'Sokha Meas');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updateSupplierMock).toHaveBeenCalledWith(
        'supplier-1',
        expect.objectContaining({ contactName: 'Sokha Meas' }),
      );
    });
  });

  it('archives a supplier after a confirmation', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    expect(await screen.findByText('Archive this supplier?')).toBeInTheDocument();
    expect(archiveSupplierMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Archive supplier' }));

    await waitFor(() => {
      expect(archiveSupplierMock).toHaveBeenCalledWith('supplier-1');
    });
  });

  it('rejects an invalid email before calling the API', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(await screen.findByRole('button', { name: 'Add supplier' }));
    await user.type(screen.getByLabelText('Supplier name'), 'Another Supplier');
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Create supplier' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(createSupplierMock).not.toHaveBeenCalled();
  });
});
