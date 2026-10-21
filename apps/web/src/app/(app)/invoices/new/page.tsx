'use client';

import { useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useI18n } from '@/components/i18n-provider';
import { InvoiceDetail } from '@/features/invoices/invoice-detail';
import { InvoiceScreen } from '@/features/invoices/invoice-screen';
import type { Invoice } from '@/lib/types';

export default function NewInvoicePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [currency, setCurrency] = useState('');

  if (invoice !== null) {
    return (
      <div className="page-stack">
        <section className="page-heading">
          <div>
            <p className="eyebrow">{t('app.workspace')}</p>
            <h2>{t('invoices.savedTitle')}</h2>
            <p className="muted">{t('invoices.savedSubtitle')}</p>
          </div>
          <div className="row-actions">
            <Link href="/invoices" className="button button--quiet">
              {t('invoices.backToList')}
            </Link>
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                setInvoice(null);
              }}
            >
              {t('invoices.newTitle')}
            </button>
          </div>
        </section>

        {invoice.creditLimitWarning !== null ? (
          <p className="alert alert--info" role="alert">
            {invoice.creditLimitWarning}
          </p>
        ) : null}

        <InvoiceDetail
          invoice={invoice}
          currency={currency}
          canVoid={false}
          onVoid={() => undefined}
        />
      </div>
    );
  }

  return (
    <InvoiceScreen
      onSaved={(saved, savedCurrency) => {
        setInvoice(saved);
        setCurrency(savedCurrency);
      }}
      onCancel={() => {
        router.push('/invoices');
      }}
    />
  );
}
