'use client';

import { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';

import { useI18n } from '@/components/i18n-provider';
import {
  getCreditAgeing,
  getCreditOverview,
  getCreditOverdue,
  getDepotSettings,
} from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { formatDate, formatMoney } from '@/lib/format';
import type { AgeingBucket, CreditOverview, OverdueInvoice } from '@/lib/types';

export function CreditManager() {
  const { t, locale } = useI18n();
  const [overview, setOverview] = useState<CreditOverview | null>(null);
  const [overdue, setOverdue] = useState<OverdueInvoice[]>([]);
  const [ageing, setAgeing] = useState<AgeingBucket[]>([]);
  const [currency, setCurrency] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const [overviewView, overduePage, ageingView, settings] = await Promise.all([
        getCreditOverview(),
        getCreditOverdue(1, 50),
        getCreditAgeing(),
        getDepotSettings(),
      ]);

      setOverview(overviewView);
      setOverdue(overduePage.data);
      setAgeing(ageingView.ageing);
      setCurrency(settings.currency);
    } catch (error) {
      setLoadError(getErrorMessage(t, error));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const money = (amount: string) =>
    currency === '' ? amount : formatMoney(amount, currency, locale);

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t('app.workspace')}</p>
          <h2>{t('credit.title')}</h2>
          <p className="muted">{t('credit.subtitle')}</p>
        </div>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => setReloadKey((value) => value + 1)}
          disabled={loading}
        >
          {t('common.retry')}
        </button>
      </section>

      {loadError !== null ? (
        <p className="alert alert--error" role="alert">
          {loadError}
        </p>
      ) : null}

      {overview !== null ? (
        <section className="summary-grid">
          <article className="summary-card">
            <span className="summary-card__label">{t('credit.totalOutstanding')}</span>
            <strong className="money">{money(overview.totalOutstanding)}</strong>
          </article>
          <article className="summary-card">
            <span className="summary-card__label">{t('credit.totalOverdue')}</span>
            <strong className="money">{money(overview.totalOverdue)}</strong>
          </article>
          <article className="summary-card">
            <span className="summary-card__label">{t('credit.totalRefundDue')}</span>
            <strong className="money">{money(overview.totalRefundDue)}</strong>
          </article>
        </section>
      ) : null}

      <section className="panel panel--flush" aria-labelledby="credit-ageing-title">
        <div className="toolbar toolbar--wrap">
          <h3 id="credit-ageing-title" className="toolbar__title">
            {t('credit.ageingTitle')}
          </h3>
        </div>

        <div className="table-wrap">
          <table className="data-table product-table">
            <thead>
              <tr>
                <th scope="col">{t('credit.tableBucket')}</th>
                <th scope="col">{t('credit.tableInvoices')}</th>
                <th scope="col">{t('credit.tableAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {ageing.map((bucket) => (
                <tr key={bucket.key}>
                  <td>{t(`credit.bucket.${bucket.key}`)}</td>
                  <td>{bucket.invoiceCount}</td>
                  <td className="money">{money(bucket.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel panel--flush" aria-labelledby="credit-overdue-title">
        <div className="toolbar toolbar--wrap">
          <h3 id="credit-overdue-title" className="toolbar__title">
            {t('credit.overdueTitle')}
          </h3>
        </div>

        {overdue.length === 0 ? (
          <p className="muted">{t('credit.noOverdue')}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table product-table">
              <thead>
                <tr>
                  <th scope="col">{t('invoices.tableNumber')}</th>
                  <th scope="col">{t('invoices.tableCustomer')}</th>
                  <th scope="col">{t('invoices.dueDate')}</th>
                  <th scope="col">{t('credit.tableDaysOverdue')}</th>
                  <th scope="col">{t('invoices.outstanding')}</th>
                </tr>
              </thead>
              <tbody>
                {overdue.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.invoiceNumber}</td>
                    <td>
                      <Link href={`/customers/${invoice.customerId}`}>{invoice.customerName}</Link>
                    </td>
                    <td>{invoice.dueDate === null ? '—' : formatDate(invoice.dueDate, locale)}</td>
                    <td>{t('credit.daysOverdue', { days: invoice.daysOverdue })}</td>
                    <td className="money">{money(invoice.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {loading ? (
        <p className="muted" role="status">
          {t('common.loading')}
        </p>
      ) : null}
    </div>
  );
}
