/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { I18nProvider } from '@/components/i18n-provider';
import { ImageUpload } from '@/components/image-upload';
import { ApiError } from '@/lib/api-error';
import { confirmLogoImage, requestLogoReadUrl, requestLogoUploadUrl } from '@/lib/api-client';
import type { PresignedRead, PresignedUpload } from '@/lib/types';

jest.mock('@/lib/api-client', () => ({
  requestLogoUploadUrl: jest.fn(),
  requestLogoReadUrl: jest.fn(),
  confirmLogoImage: jest.fn(),
  requestProductImageUploadUrl: jest.fn(),
  requestProductImageReadUrl: jest.fn(),
  confirmProductImage: jest.fn(),
}));

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

function renderImageUpload({
  existingKey = null,
  onUploaded,
}: {
  existingKey?: string | null;
  onUploaded?: (key: string) => void;
} = {}) {
  return render(
    <I18nProvider initialLocale="en">
      <ImageUpload
        kind="logo"
        existingKey={existingKey}
        label="Depot logo"
        onUploaded={onUploaded}
      />
    </I18nProvider>,
  );
}

async function chooseLogo() {
  const user = userEvent.setup();
  const input = screen.getByTestId('image-upload-input');
  await user.upload(input, new File(['png'], 'logo.png', { type: 'image/png' }));
  return user;
}

describe('ImageUpload', () => {
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
  });

  it('rejects a non-image file type with a clear error', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderImageUpload();

    const input = screen.getByTestId('image-upload-input');
    await user.upload(input, new File(['hello'], 'doc.txt', { type: 'text/plain' }));

    expect(screen.getByText('Only JPEG, PNG, and WebP images are allowed.')).toBeInTheDocument();
  });

  it('rejects a file larger than 2 MB', async () => {
    const user = userEvent.setup();
    renderImageUpload();

    const input = screen.getByTestId('image-upload-input');
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', {
      type: 'image/png',
    });

    await user.upload(input, big);

    expect(screen.getByText('The image must be 2 MB or smaller.')).toBeInTheDocument();
  });

  it('clears the error and the selected file', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderImageUpload();

    const input = screen.getByTestId('image-upload-input');
    await user.upload(input, new File(['hello'], 'doc.txt', { type: 'text/plain' }));

    expect(screen.getByText('Only JPEG, PNG, and WebP images are allowed.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(
      screen.queryByText('Only JPEG, PNG, and WebP images are allowed.'),
    ).not.toBeInTheDocument();
  });

  it('uploads, confirms, and shows the image from the presigned read URL', async () => {
    uploadMock.mockResolvedValue(PRESIGNED);
    confirmMock.mockResolvedValue({ key: KEY });
    readMock.mockResolvedValue(READ);
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const onUploaded = jest.fn();

    renderImageUpload({ onUploaded });
    const user = await chooseLogo();
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalledWith(KEY);
      expect(onUploaded).toHaveBeenCalledWith(KEY);
      expect(screen.getByAltText('Uploaded image preview')).toHaveAttribute('src', READ.url);
    });

    expect(uploadMock).toHaveBeenCalledWith('image/png');
    expect(fetchMock).toHaveBeenCalledWith(
      PRESIGNED.url,
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
      }),
    );
  });

  it('shows a network/CORS message when the direct upload cannot reach storage', async () => {
    uploadMock.mockResolvedValue(PRESIGNED);
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    renderImageUpload();
    const user = await chooseLogo();
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    expect(
      await screen.findByText(
        'Could not upload the image to storage. Check your connection and the bucket CORS rule, then try again.',
      ),
    ).toBeInTheDocument();
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it('shows the storage status when the direct upload is rejected', async () => {
    uploadMock.mockResolvedValue(PRESIGNED);
    fetchMock.mockResolvedValue({ ok: false, status: 403 });

    renderImageUpload();
    const user = await chooseLogo();
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    expect(
      await screen.findByText(
        'Storage rejected the upload (HTTP 403). Check the bucket CORS rule and token permissions, then try again.',
      ),
    ).toBeInTheDocument();
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it('shows a confirm failure instead of silently succeeding', async () => {
    uploadMock.mockResolvedValue(PRESIGNED);
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    confirmMock.mockRejectedValue(new ApiError('Forbidden', 403));

    renderImageUpload();
    const user = await chooseLogo();
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    expect(
      await screen.findByText(
        'The image was uploaded but could not be saved. Your role is not allowed to do this.',
      ),
    ).toBeInTheDocument();
  });

  it('loads the stored image from the read URL after a reload', async () => {
    readMock.mockResolvedValue(READ);

    renderImageUpload({ existingKey: KEY });

    expect(await screen.findByAltText('Uploaded image preview')).toHaveAttribute('src', READ.url);
  });
});
