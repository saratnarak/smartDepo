/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { I18nProvider } from '@/components/i18n-provider';
import { DepotSettingsForm } from '@/features/depot-settings/depot-settings-form';
import {
  confirmLogoImage,
  getDepotSettings,
  requestLogoReadUrl,
  requestLogoUploadUrl,
  updateDepotSettings,
} from '@/lib/api-client';
import type { DepotSettings, PresignedRead, PresignedUpload, UserRole } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';

jest.mock('@/lib/api-client', () => ({
  getDepotSettings: jest.fn(),
  updateDepotSettings: jest.fn(),
  requestLogoUploadUrl: jest.fn(),
  requestLogoReadUrl: jest.fn(),
  confirmLogoImage: jest.fn(),
  requestProductImageUploadUrl: jest.fn(),
  requestProductImageReadUrl: jest.fn(),
  confirmProductImage: jest.fn(),
}));

const getMock = getDepotSettings as jest.MockedFunction<typeof getDepotSettings>;
const updateMock = updateDepotSettings as jest.MockedFunction<typeof updateDepotSettings>;
const uploadMock = requestLogoUploadUrl as jest.MockedFunction<typeof requestLogoUploadUrl>;
const readMock = requestLogoReadUrl as jest.MockedFunction<typeof requestLogoReadUrl>;
const confirmMock = confirmLogoImage as jest.MockedFunction<typeof confirmLogoImage>;
const fetchMock = jest.fn();

const KEY = 'depots/depot-1/logo/user-1/logo.png';
const PRESIGNED: PresignedUpload = {
  url: 'https://r2.example/upload',
  key: KEY,
  contentType: 'image/png',
  method: 'PUT',
  expiresIn: 300,
};
const READ: PresignedRead = {
  url: 'https://r2.example/read',
  key: KEY,
  expiresIn: 300,
};

const SETTINGS: DepotSettings = {
  id: 'depot-1',
  name: 'Boeng Keng Kong Depot',
  address: 'Street 271, Phnom Penh',
  currency: 'KHR',
  locale: 'EN',
  invoiceFooter: 'Thank you for your business.',
  logoKey: null,
};

function renderForm(role: UserRole) {
  useSessionStore.setState({
    user: {
      id: 'user-1',
      name: 'User',
      email: 'user@example.com',
      phone: null,
      role,
      depotId: role === 'PLATFORM_ADMIN' ? null : 'depot-1',
      mustChangePassword: false,
    },
    role,
    depot: { id: 'depot-1', name: 'Boeng Keng Kong Depot', status: 'APPROVED' },
    accessToken: 'access-token',
    status: 'authenticated',
    logoutReason: null,
  });

  return render(
    <I18nProvider initialLocale="en">
      <DepotSettingsForm />
    </I18nProvider>,
  );
}

async function chooseLogo() {
  const user = userEvent.setup();
  const input = await screen.findByTestId('image-upload-input');
  await user.upload(input, new File(['png'], 'logo.png', { type: 'image/png' }));
  return user;
}

describe('DepotSettingsForm', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(URL, 'createObjectURL', {
      value: jest.fn(() => 'blob:preview'),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: jest.fn(),
      configurable: true,
      writable: true,
    });
    getMock.mockResolvedValue(SETTINGS);
  });

  it('shows read-only depot values to staff roles', async () => {
    renderForm('SALES');

    expect(await screen.findByText('Depot details')).toBeInTheDocument();
    expect(screen.getByText('Boeng Keng Kong Depot')).toBeInTheDocument();
    expect(screen.getByText('Street 271, Phnom Penh')).toBeInTheDocument();
    expect(screen.getByText('KHR')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Thank you for your business.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save settings' })).not.toBeInTheDocument();
  });

  it('lets the owner update the settings and refreshes the depot name', async () => {
    const user = userEvent.setup();
    const updated = { ...SETTINGS, name: 'Depot Renamed' };
    updateMock.mockResolvedValue(updated);
    renderForm('OWNER');

    const name = await screen.findByLabelText('Depot name');
    await user.clear(name);
    await user.type(name, 'Depot Renamed');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({
        name: 'Depot Renamed',
        address: 'Street 271, Phnom Penh',
        currency: 'KHR',
        locale: 'EN',
        invoiceFooter: 'Thank you for your business.',
      });
      expect(useSessionStore.getState().depot?.name).toBe('Depot Renamed');
      expect(screen.getByText('Depot settings saved.')).toBeInTheDocument();
    });
  });

  it('shows the stored logo from R2 after a page reload', async () => {
    getMock.mockResolvedValue({ ...SETTINGS, logoKey: KEY });
    readMock.mockResolvedValue(READ);

    renderForm('OWNER');

    expect(await screen.findByAltText('Uploaded image preview')).toHaveAttribute('src', READ.url);
  });

  it('does not claim success when the logo upload fails', async () => {
    uploadMock.mockResolvedValue(PRESIGNED);
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    renderForm('OWNER');
    const user = await chooseLogo();
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(
      await screen.findByText(
        'Settings were not saved because the logo upload failed. Fix the error above and try again.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Could not upload the image to storage. Check your connection and the bucket CORS rule, then try again.',
      ),
    ).toBeInTheDocument();
    expect(updateMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Depot settings saved.')).not.toBeInTheDocument();
  });

  it('uploads and confirms the logo before saving the settings', async () => {
    const updated = { ...SETTINGS, name: 'Depot Renamed', logoKey: KEY };
    uploadMock.mockResolvedValue(PRESIGNED);
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    confirmMock.mockResolvedValue({ key: KEY });
    readMock.mockResolvedValue(READ);
    updateMock.mockResolvedValue(updated);

    renderForm('OWNER');
    const user = await chooseLogo();
    const name = screen.getByLabelText('Depot name');
    await user.clear(name);
    await user.type(name, 'Depot Renamed');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalledWith('image/png');
      expect(confirmMock).toHaveBeenCalledWith(KEY);
      expect(updateMock).toHaveBeenCalled();
      expect(screen.getByText('Depot settings saved.')).toBeInTheDocument();
      expect(screen.getByAltText('Uploaded image preview')).toHaveAttribute('src', READ.url);
    });
  });
});
