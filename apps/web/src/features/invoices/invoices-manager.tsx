'use client';

import { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';

import { useI18n } from '@/components/i18n-provider';
import {
  getDepotSettings,
  listCustomers,
  listInvoices,
  voidInvoice,
  type ListInvoicesParams,
} from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { formatDate, formatMoney } from '@/lib/format';
import type { Customer, Invoice, PaymentStatus } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';
import { InvoiceDetail } from './invoice-detail';
import { VoidInvoiceDialog } from './void-invoice-dialog';

const PAGE_SIZE = 20;

type PaymentStatusFilter = '' | PaymentStatus;

export function InvoicesManager() {
  const { t, locale } = useI18n();
  const role = useSessionStore((state) => state.role);
  const canVoid = role === 'OWNER';

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{
    data: Invoice[];
    meta: { page: number; pageSize: number; total: number };
  } | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currency, setCurrency] = useState('');
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingVoid, setPendingVoid] = useState<Invoice | null>(null);
  const [voidBusy, setVoidBusy] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const params: ListInvoicesParams = {
      search,
      customerId: customerId === '' ? undefined : customerId,
      paymentStatus: paymentStatus === '' ? undefined : paymentStatus,
      from: from === '' ? undefined : `${from}T00:00:00.000Z`,
      to: to === '' ? undefined : `${to}T23:59:59.999Z`,
      page,
      pageSize: PAGE_SIZE,
    };

    try {
      setResult(await listInvoices(params));
    } catch (error) {
      setLoadError(getErrorMessage(t, error));
    } finally {
      setLoading(false);
    }
  }, [search, customerId, paymentStatus, from, to, page, t]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  useEffect(() => {
    let active = true;

    void Promise.all([
      listCustomers({ pageSize: 100, isActive: true, sort: 'name', order: 'asc' }),
      getDepotSettings(),
    ])
      .then(([customerPage, settings]) => {
        if (active) {
          setCustomers(customerPage.data);
          setCurrency(settings.currency);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const money = (amount: string) =>
    currency === '' ? amount : formatMoney(amount, currency, locale);

  const rows = result?.data ?? [];
  const total = result?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const confirmVoid = async (reason: string) => {
    if (pendingVoid === null) {
      return;
    }

    setVoidBusy(true);
    setVoidError(null);

    try {
      const voided = await voidInvoice(pendingVoid.id, reason);
      setPendingVoid(null);
      setDetail(voided);
      setNotice(t('invoices.voided'));
      setReloadKey((value) => value + 1);
    } catch (error) {
      setVoidError(getErrorMessage(t, error));
    } finally {
      setVoidBusy(false);
    }
  };

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t('app.workspace')}</p>
          <h2>{t('invoices.title')}</h2>
          <p className="muted">{t('invoices.subtitle')}</p>
        </div>
        <Link href="/invoices/new" className="button button--primary">
          {t('invoices.add')}
        </Link>
      </section>

      {notice !== null ? (
        <p className="alert alert--success" role="status">
          {notice}
        </p>
      ) : null}

      {detail !== null ? (
        <InvoiceDetail
          invoice={detail}
          currency={currency}
          canVoid={canVoid}
          onVoid={(invoice) => {
            setVoidError(null);
            setPendingVoid(invoice);
          }}
        />
      ) : null}

      <section className="panel panel--flush" aria-labelledby="invoice-list-title">
        <div className="toolbar toolbar--wrap">
          <h3 id="invoice-list-title" className="toolbar__title">
            {t('invoices.listTitle')}
          </h3>
        </div>

        <div className="catalog-filters">
          <div className="field">
            <label htmlFor="invoice-list-search">{t('invoices.search')}</label>
            <input
              id="invoice-list-search"
              value={searchInput}
              placeholder={t('invoices.searchPlaceholder')}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="invoice-list-customer">{t('invoices.customer')}</label>
            <select
              id="invoice-list-customer"
              value={customerId}
              onChange={(event) => {
                setCustomerId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('invoices.allCustomers')}</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="invoice-list-payment-status">{t('invoices.paymentStatus')}</label>
            <select
              id="invoice-list-payment-status"
              value={paymentStatus}
              onChange={(event) => {
                setPaymentStatus(event.target.value as PaymentStatusFilter);
                setPage(1);
              }}
            >
              <option value="">{t('invoices.allPaymentStatuses')}</option>
              <option value="PAID">{t('paymentStatus.PAID')}</option>
              <option value="PARTIAL">{t('paymentStatus.PARTIAL')}</option>
              <option value="UNPAID">{t('paymentStatus.UNPAID')}</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="invoice-list-from">{t('invoices.filterFrom')}</label>
            <input
              id="invoice-list-from"
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="field">
            <label htmlFor="invoice-list-to">{t('invoices.filterTo')}</label>
            <input
              id="invoice-list-to"
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {loadError !== null ? (
          <div className="panel__body">
            <p className="alert alert--error" role="alert">
              {loadError}
            </p>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              {t('common.retry')}
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="table-skeleton" role="status" aria-live="polite">
            <span className="visually-hidden">{t('common.loading')}</span>
            {[0, 1, 2].map((row) => (
              <div key={row} className="skeleton-row">
                <span className="skeleton" />
                <span className="skeleton" />
                <span className="skeleton" />
                <span className="skeleton" />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && loadError === null && rows.length === 0 ? (
          <div className="empty-state empty-state--large">
            <span className="empty-state__mark" aria-hidden="true">
              0
            </span>
            <div>
              <strong>{t('invoices.emptyTitle')}</strong>
              <p>{t('invoices.emptyBody')}</p>
            </div>
          </div>
        ) : null}

        {!loading && loadError === null && rows.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table product-table">
              <thead>
                <tr>
                  <th scope="col">{t('invoices.tableNumber')}</th>
                  <th scope="col">{t('invoices.tableCustomer')}</th>
                  <th scope="col">{t('invoices.orderDate')}</th>
                  <th scope="col">{t('invoices.total')}</th>
                  <th scope="col">{t('invoices.paymentStatus')}</th>
                  <th scope="col" className="data-table__actions">
                    {t('invoices.tableActions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <div className="table-primary">
                        <strong>{invoice.invoiceNumber}</strong>
                        <small>
                          {invoice.status === 'VOIDED'
                            ? t('invoices.statusVoided')
                            : t(`paymentStatus.${invoice.paymentStatus}`)}
                        </small>
                      </div>
                    </td>
                    <td>{invoice.customerName}</td>
                    <td>{formatDate(invoice.orderDate, locale)}</td>
                    <td className="money">{money(invoice.total)}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          invoice.status === 'VOIDED'
                            ? 'status-badge--rejected'
                            : invoice.paymentStatus === 'PAID'
                              ? 'status-badge--approved'
                              : 'status-badge--pending'
                        }`}
                      >
                        <span className="status-badge__dot" aria-hidden="true" />
                        {invoice.status === 'VOIDED'
                          ? t('invoices.statusVoided')
                          : t(`paymentStatus.${invoice.paymentStatus}`)}
                      </span>
                    </td>
                    <td className="data-table__actions">
                      <button
                        type="button"
                        className="button button--small button--secondary"
                        onClick={() => setDetail(invoice)}
                      >
                        {t('invoices.view')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && loadError === null ? (
          <div className="pagination">
            <span className="muted">{t('invoices.showing', { count: rows.length, total })}</span>
            {totalPages > 1 ? (
              <div className="pagination__controls">
                <button
                  type="button"
                  className="button button--secondary button--small"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={page <= 1}
                >
                  {t('common.previous')}
                </button>
                <span>{t('common.pageOf', { page, pages: totalPages })}</span>
                <button
                  type="button"
                  className="button button--secondary button--small"
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  disabled={page >= totalPages}
                >
                  {t('common.next')}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <VoidInvoiceDialog
        invoice={pendingVoid}
        busy={voidBusy}
        error={voidError}
        onConfirm={(reason) => void confirmVoid(reason)}
        onClose={() => {
          if (!voidBusy) {
            setPendingVoid(null);
            setVoidError(null);
          }
        }}
      />
    </div>
  );
}
