'use client';

import { useEffect, useId, useState } from 'react';

import { useI18n } from '@/components/i18n-provider';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  error?: string | null;
  reason?: {
    label: string;
    placeholder: string;
  };
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = 'primary',
  busy = false,
  error = null,
  reason,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const titleId = useId();
  const descriptionId = useId();
  const reasonId = useId();
  const reasonErrorId = useId();
  const [reasonValue, setReasonValue] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReasonValue('');
      setReasonError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, busy, onClose]);

  if (!open) {
    return null;
  }

  const submit = () => {
    if (reason !== undefined) {
      const trimmed = reasonValue.trim();
      if (trimmed.length < 3 || trimmed.length > 500) {
        setReasonError(t('validation.reasonLength'));
        return;
      }
      onConfirm(trimmed);
      return;
    }

    onConfirm('');
  };

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="dialog__header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label={t('common.close')}
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
        </div>

        <p id={descriptionId} className="dialog__description">
          {description}
        </p>

        {reason !== undefined ? (
          <div className="field">
            <label htmlFor={reasonId}>{reason.label}</label>
            <textarea
              id={reasonId}
              value={reasonValue}
              placeholder={reason.placeholder}
              rows={4}
              maxLength={500}
              aria-invalid={reasonError !== null}
              aria-describedby={reasonError !== null ? reasonErrorId : undefined}
              onChange={(event) => {
                setReasonValue(event.target.value);
                if (reasonError !== null) {
                  setReasonError(null);
                }
              }}
              disabled={busy}
            />
            {reasonError !== null ? (
              <p id={reasonErrorId} className="field__error">
                {reasonError}
              </p>
            ) : null}
          </div>
        ) : null}

        {error !== null ? (
          <p className="alert alert--error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="dialog__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={onClose}
            disabled={busy}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className={`button ${tone === 'danger' ? 'button--danger' : 'button--primary'}`}
            onClick={submit}
            disabled={busy}
          >
            {busy ? t('common.loading') : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
