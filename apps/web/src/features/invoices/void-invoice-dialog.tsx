'use client';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { useI18n } from '@/components/i18n-provider';
import type { Invoice } from '@/lib/types';

interface VoidInvoiceDialogProps {
  invoice: Invoice | null;
  busy: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/** The void dialog asks for a reason, which the API stores with the audit entry. */
export function VoidInvoiceDialog({
  invoice,
  busy,
  error,
  onConfirm,
  onClose,
}: VoidInvoiceDialogProps) {
  const { t } = useI18n();

  return (
    <ConfirmDialog
      open={invoice !== null}
      title={t('invoices.voidTitle')}
      description={
        invoice === null ? '' : t('invoices.voidMessage', { reference: invoice.invoiceNumber })
      }
      confirmLabel={t('invoices.confirmVoid')}
      tone="danger"
      busy={busy}
      error={error}
      reason={{
        label: t('invoices.voidReason'),
        placeholder: t('invoices.voidReasonPlaceholder'),
      }}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
