'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { useI18n } from '@/components/i18n-provider';
import { ApiError } from '@/lib/api-error';
import {
  confirmLogoImage,
  confirmProductImage,
  requestLogoReadUrl,
  requestLogoUploadUrl,
  requestProductImageReadUrl,
  requestProductImageUploadUrl,
} from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { IMAGE_CONTENT_TYPES } from '@/lib/types';
import type { ImageContentType } from '@/lib/types';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ACCEPT = IMAGE_CONTENT_TYPES.join(',');

export type ImageUploadOutcome =
  | { status: 'none' }
  | { status: 'busy'; message: string }
  | { status: 'uploaded'; key: string }
  | { status: 'failed'; message: string };

export interface ImageUploadHandle {
  upload: () => Promise<ImageUploadOutcome>;
}

export interface ImageUploadProps {
  kind: 'logo' | 'product';
  productId?: string;
  existingKey?: string | null;
  /**
   * Some responses do not expose the stored key (the catalog API does not yet). Set this to true to
   * ask the read-url endpoint for the current image anyway; a 404 is treated as "no image".
   */
  hasStoredImage?: boolean;
  label: string;
  onUploaded?: (key: string) => void;
}

class UploadRejectedError extends Error {
  constructor(readonly status: number) {
    super(`Upload rejected with HTTP ${String(status)}`);
    this.name = 'UploadRejectedError';
  }
}

function isAllowedType(type: string): type is ImageContentType {
  return (IMAGE_CONTENT_TYPES as readonly string[]).includes(type);
}

export const ImageUpload = forwardRef<ImageUploadHandle, ImageUploadProps>(function ImageUpload(
  { kind, productId, existingKey, hasStoredImage = false, label, onUploaded },
  ref,
) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [existingUrl, setExistingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadExisting = useCallback(async () => {
    setExistingUrl(null);

    if (!hasStoredImage && (existingKey === null || existingKey === undefined)) {
      return;
    }

    try {
      const read =
        kind === 'logo'
          ? await requestLogoReadUrl()
          : await requestProductImageReadUrl(productId ?? '');

      setExistingUrl(read.url);
    } catch {
      setExistingUrl(null);
    }
  }, [existingKey, hasStoredImage, kind, productId]);

  useEffect(() => {
    void loadExisting();
  }, [loadExisting]);

  useEffect(() => {
    return () => {
      if (previewUrl !== null) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const clearSelection = useCallback(() => {
    if (previewUrl !== null) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(null);
    setPreviewUrl(null);
    setError(null);

    if (inputRef.current !== null) {
      inputRef.current.value = '';
    }
  }, [previewUrl]);

  const selectFile = (selected: File) => {
    if (!isAllowedType(selected.type)) {
      if (previewUrl !== null) {
        URL.revokeObjectURL(previewUrl);
      }
      setError(t('imageUpload.invalidType'));
      setFile(null);
      setPreviewUrl(null);
      return;
    }

    if (selected.size > MAX_IMAGE_BYTES) {
      if (previewUrl !== null) {
        URL.revokeObjectURL(previewUrl);
      }
      setError(t('imageUpload.tooLarge'));
      setFile(null);
      setPreviewUrl(null);
      return;
    }

    if (previewUrl !== null) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setError(null);
  };

  const upload = useCallback(async (): Promise<ImageUploadOutcome> => {
    if (uploadingRef.current) {
      return { status: 'busy', message: t('imageUpload.inProgress') };
    }

    if (file === null) {
      return error === null ? { status: 'none' } : { status: 'failed', message: error };
    }

    uploadingRef.current = true;
    setUploading(true);
    setError(null);

    let stage: 'presign' | 'upload' | 'confirm' = 'presign';

    try {
      const presigned =
        kind === 'logo'
          ? await requestLogoUploadUrl(file.type as ImageContentType)
          : await requestProductImageUploadUrl(productId ?? '', file.type as ImageContentType);

      stage = 'upload';
      const response = await fetch(presigned.url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!response.ok) {
        throw new UploadRejectedError(response.status);
      }

      stage = 'confirm';

      if (kind === 'logo') {
        await confirmLogoImage(presigned.key);
      } else {
        await confirmProductImage(productId ?? '', presigned.key);
      }

      setFile(null);
      if (previewUrl !== null) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      setExistingUrl(null);
      onUploaded?.(presigned.key);

      try {
        const read =
          kind === 'logo'
            ? await requestLogoReadUrl()
            : await requestProductImageReadUrl(productId ?? '');

        setExistingUrl(read.url);
      } catch {
        setError(t('imageUpload.previewFailed'));
      }

      return { status: 'uploaded', key: presigned.key };
    } catch (caught) {
      let message = t('imageUpload.failed');

      if (caught instanceof UploadRejectedError) {
        message = t('imageUpload.uploadRejected', { status: caught.status });
      } else if (stage === 'upload') {
        message = t('imageUpload.network');
      } else if (caught instanceof ApiError) {
        message =
          stage === 'confirm'
            ? t('imageUpload.confirmFailed', { message: getErrorMessage(t, caught) })
            : t('imageUpload.presignFailed', { message: getErrorMessage(t, caught) });
      }

      setError(message);
      return { status: 'failed', message };
    } finally {
      uploadingRef.current = false;
      setUploading(false);
    }
  }, [error, file, kind, onUploaded, previewUrl, productId, t]);

  useImperativeHandle(ref, () => ({ upload }), [upload]);

  const preview = previewUrl ?? existingUrl;

  return (
    <div className="image-upload" aria-labelledby="image-upload-label" aria-busy={uploading}>
      <span id="image-upload-label" className="image-upload__label">
        {label}
      </span>

      {preview !== null ? (
        // Presigned and object URLs are dynamic, so use a plain img without the Next image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="image-upload__preview" src={preview} alt={t('imageUpload.alt')} />
      ) : null}

      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept={ACCEPT}
        data-testid="image-upload-input"
        disabled={uploading}
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (selected !== undefined) {
            selectFile(selected);
          }
        }}
      />

      <div className="image-upload__controls">
        <button
          type="button"
          className="button button--secondary"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {t('imageUpload.choose')}
        </button>
        {file !== null ? (
          <button
            type="button"
            className="button button--ghost"
            disabled={uploading}
            onClick={() => {
              void upload();
            }}
          >
            {uploading ? t('imageUpload.uploading') : t('imageUpload.upload')}
          </button>
        ) : null}
        {error !== null || file !== null ? (
          <button
            type="button"
            className="button button--ghost"
            disabled={uploading}
            onClick={clearSelection}
          >
            {t('imageUpload.clear')}
          </button>
        ) : null}
      </div>

      {error !== null ? (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      ) : (
        <p className="muted image-upload__hint">{t('imageUpload.hint')}</p>
      )}
    </div>
  );
});
