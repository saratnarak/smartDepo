'use client';

import { useEffect, useId } from 'react';

import { useI18n } from '@/components/i18n-provider';

interface ModalProps {
  open: boolean;
  title: string;
  busy?: boolean;
  children: React.ReactNode;
  onClose: () => void;
}

export function Modal({ open, title, busy = false, children, onClose }: ModalProps) {
  const { t } = useI18n();
  const titleId = useId();

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

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
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
        {children}
      </div>
    </div>
  );
}
