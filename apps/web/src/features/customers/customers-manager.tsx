'use client';

import { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { useI18n } from '@/components/i18n-provider';
import { archiveCustomer, getDepotSettings, listCustomers } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/format';
import type { Customer, CustomerType } from '@/lib/types';
import { CustomerForm } from './customer-form';

const PAGE_SIZE = 20;

type StatusFilter = '' | 'active' | 'archived';

export function CustomersManager() {
  const { t, locale } = useI18n();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<CustomerType | ''>('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{
    data: Customer[];
    meta: { page: number; pageSize: number; total: number };
  } | null>(null);
  const [currency, setCurrency] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [pendingArchive, setPendingArchive] = useState<Customer | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
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

    try {
      const [customerPage, settings] = await Promise.all([
        listCustomers({
          search,
          type: type === '' ? undefined : type,
          isActive: status === '' ? undefined : status === 'active',
          page,
          pageSize: PAGE_SIZE,
          sort: 'name',
          order: 'asc',
        }),
        getDepotSettings(),
      ]);

      setResult(customerPage);
      setCurrency(settings.currency);
    } catch (error) {
      setLoadError(getErrorMessage(t, error));
    } finally {
      setLoading(false);
    }
  }, [search, type, status, page, t]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const money = (amount: string) =>
    currency === '' ? amount : formatMoney(amount, currency, locale);

  const rows = result?.data ?? [];
  const total = result?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const confirmArchive = async () => {
    if (pendingArchive === null) {
      return;
    }

    setArchiveBusy(true);
    setArchiveError(null);

    try {
      await archiveCustomer(pendingArchive.id);
      setPendingArchive(null);
      setNotice(t('customers.archived'));
      setReloadKey((value) => value + 1);
    } catch (error) {
      setArchiveError(getErrorMessage(t, error));
    } finally {
      setArchiveBusy(false);
    }
  };

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t('app.workspace')}</p>
          <h2>{t('customers.title')}</h2>
          <p className="muted">{t('customers.subtitle')}</p>
        </div>
        <button
          type="button"
          className="button button--primary"
          onClick={() => {
            setNotice(null);
            setActionError(null);
            setEditing(null);
            setFormOpen(true);
          }}
        >
          {t('customers.add')}
        </button>
      </section>

      {notice !== null ? (
        <p className="alert alert--success" role="status">
          {notice}
        </p>
      ) : null}

      {actionError !== null ? (
        <p className="alert alert--error" role="alert">
          {actionError}
        </p>
      ) : null}

      {formOpen ? (
        <CustomerForm
          key={editing?.id ?? 'new'}
          customer={editing}
          onSaved={() => {
            setNotice(editing === null ? t('customers.created') : t('customers.updated'));
            setEditing(null);
            setFormOpen(false);
            setReloadKey((value) => value + 1);
          }}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      ) : null}

      <section className="panel panel--flush" aria-labelledby="customer-list-title">
        <div className="toolbar toolbar--wrap">
          <h3 id="customer-list-title" className="toolbar__title">
            {t('customers.listTitle')}
          </h3>
        </div>

        <div className="catalog-filters">
          <div className="field">
            <label htmlFor="customer-search">{t('customers.search')}</label>
            <input
              id="customer-search"
              value={searchInput}
              placeholder={t('customers.searchPlaceholder')}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="customer-filter-type">{t('customers.customerType')}</label>
            <select
              id="customer-filter-type"
              value={type}
              onChange={(event) => {
                setType(event.target.value as CustomerType | '');
                setPage(1);
              }}
            >
              <option value="">{t('customers.allTypes')}</option>
              <option value="RETAIL">{t('customers.types.RETAIL')}</option>
              <option value="WHOLESALE">{t('customers.types.WHOLESALE')}</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="customer-filter-status">{t('customers.filterStatus')}</label>
            <select
              id="customer-filter-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as StatusFilter);
                setPage(1);
              }}
            >
              <option value="">{t('customers.allStatuses')}</option>
              <option value="active">{t('customers.active')}</option>
              <option value="archived">{t('customers.archivedLabel')}</option>
            </select>
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
              <strong>{t('customers.emptyTitle')}</strong>
              <p>{t('customers.emptyBody')}</p>
            </div>
          </div>
        ) : null}

        {!loading && loadError === null && rows.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table product-table">
              <thead>
                <tr>
                  <th scope="col">{t('customers.tableName')}</th>
                  <th scope="col">{t('customers.customerType')}</th>
                  <th scope="col">{t('customers.tablePhone')}</th>
                  <th scope="col">{t('customers.tableBalance')}</th>
                  <th scope="col" className="data-table__actions">
                    {t('customers.tableActions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="table-primary">
                        <strong>{customer.name}</strong>
                        <small>
                          {customer.isWalkIn ? t('customers.walkIn') : (customer.email ?? '')}
                        </small>
                      </div>
                    </td>
                    <td>{t(`customers.types.${customer.type}`)}</td>
                    <td>{customer.phone ?? '—'}</td>
                    <td className="money">{money(customer.balance)}</td>
                    <td className="data-table__actions">
                      <div className="row-actions">
                        <Link
                          href={`/customers/${customer.id}`}
                          className="button button--small button--secondary"
                        >
                          {t('customers.open')}
                        </Link>
                        <button
                          type="button"
                          className="button button--small button--secondary"
                          onClick={() => {
                            setActionError(null);
                            setArchiveError(null);
                            setEditing(customer);
                            setFormOpen(true);
                          }}
                        >
                          {t('common.edit')}
                        </button>
                        {customer.isActive && !customer.isWalkIn ? (
                          <button
                            type="button"
                            className="button button--small button--danger-ghost"
                            onClick={() => {
                              setActionError(null);
                              setArchiveError(null);
                              setPendingArchive(customer);
                            }}
                          >
                            {t('common.archive')}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && loadError === null ? (
          <div className="pagination">
            <span className="muted">{t('customers.showing', { count: rows.length, total })}</span>
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

      <ConfirmDialog
        open={pendingArchive !== null}
        title={t('customers.archiveTitle')}
        description={
          pendingArchive === null
            ? ''
            : t('customers.archiveMessage', { name: pendingArchive.name })
        }
        confirmLabel={t('customers.confirmArchive')}
        tone="danger"
        busy={archiveBusy}
        error={archiveError}
        onConfirm={() => void confirmArchive()}
        onClose={() => {
          if (!archiveBusy) {
            setPendingArchive(null);
            setArchiveError(null);
          }
        }}
      />
    </div>
  );
}
