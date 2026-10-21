'use client';

import { useCallback, useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { useI18n } from '@/components/i18n-provider';
import { archiveSupplier, listSuppliers } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import type { Paginated, Supplier } from '@/lib/types';
import { SupplierForm } from './supplier-form';

const PAGE_SIZE = 20;

type StatusFilter = '' | 'active' | 'archived';

export function SuppliersManager() {
  const { t } = useI18n();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<Supplier> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [pendingArchive, setPendingArchive] = useState<Supplier | null>(null);
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
      const data = await listSuppliers({
        search,
        isActive: status === '' ? undefined : status === 'active',
        page,
        pageSize: PAGE_SIZE,
        sort: 'name',
        order: 'asc',
      });
      setResult(data);
    } catch (error) {
      setLoadError(getErrorMessage(t, error));
    } finally {
      setLoading(false);
    }
  }, [search, status, page, t]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const reload = () => {
    setReloadKey((value) => value + 1);
  };

  const rows = result?.data ?? [];
  const total = result?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openCreate = () => {
    setNotice(null);
    setActionError(null);
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (supplier: Supplier) => {
    setNotice(null);
    setActionError(null);
    setEditing(supplier);
    setFormOpen(true);
  };

  const saved = (supplier: Supplier) => {
    setNotice(editing === null ? t('suppliers.created') : t('suppliers.updated'));
    setEditing(supplier);
    setFormOpen(false);
    reload();
  };

  const confirmArchive = async () => {
    if (pendingArchive === null) {
      return;
    }

    setArchiveBusy(true);
    setArchiveError(null);

    try {
      await archiveSupplier(pendingArchive.id);
      setPendingArchive(null);
      setNotice(t('suppliers.archived'));
      reload();
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
          <h2>{t('suppliers.title')}</h2>
          <p className="muted">{t('suppliers.subtitle')}</p>
        </div>
        <button type="button" className="button button--primary" onClick={openCreate}>
          {t('suppliers.add')}
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
        <SupplierForm
          key={editing?.id ?? 'new'}
          supplier={editing}
          onSaved={saved}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      ) : null}

      <section className="panel panel--flush" aria-labelledby="supplier-list-title">
        <div className="toolbar toolbar--wrap">
          <h3 id="supplier-list-title" className="toolbar__title">
            {t('suppliers.listTitle')}
          </h3>
        </div>

        <div className="catalog-filters">
          <div className="field">
            <label htmlFor="supplier-search">{t('suppliers.search')}</label>
            <input
              id="supplier-search"
              value={searchInput}
              placeholder={t('suppliers.searchPlaceholder')}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="supplier-status">{t('suppliers.filterStatus')}</label>
            <select
              id="supplier-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as StatusFilter);
                setPage(1);
              }}
            >
              <option value="">{t('suppliers.allStatuses')}</option>
              <option value="active">{t('suppliers.active')}</option>
              <option value="archived">{t('suppliers.archivedLabel')}</option>
            </select>
          </div>
        </div>

        {loadError !== null ? (
          <div className="panel__body">
            <p className="alert alert--error" role="alert">
              {loadError}
            </p>
            <button type="button" className="button button--secondary" onClick={reload}>
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
              <strong>{t('suppliers.emptyTitle')}</strong>
              <p>{t('suppliers.emptyBody')}</p>
            </div>
          </div>
        ) : null}

        {!loading && loadError === null && rows.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table product-table">
              <thead>
                <tr>
                  <th scope="col">{t('suppliers.tableName')}</th>
                  <th scope="col">{t('suppliers.tableContact')}</th>
                  <th scope="col">{t('suppliers.tablePhone')}</th>
                  <th scope="col">{t('suppliers.tableStatus')}</th>
                  <th scope="col" className="data-table__actions">
                    {t('suppliers.tableActions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <div className="table-primary">
                        <strong>{supplier.name}</strong>
                        <small>{supplier.email ?? t('suppliers.noEmail')}</small>
                      </div>
                    </td>
                    <td>{supplier.contactName ?? t('common.notAvailable')}</td>
                    <td>{supplier.phone ?? t('common.notAvailable')}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          supplier.isActive ? 'status-badge--approved' : 'status-badge--inactive'
                        }`}
                      >
                        <span className="status-badge__dot" aria-hidden="true" />
                        {supplier.isActive ? t('suppliers.active') : t('suppliers.archivedLabel')}
                      </span>
                    </td>
                    <td className="data-table__actions">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="button button--small button--secondary"
                          onClick={() => openEdit(supplier)}
                        >
                          {t('common.edit')}
                        </button>
                        {supplier.isActive ? (
                          <button
                            type="button"
                            className="button button--small button--danger-ghost"
                            onClick={() => {
                              setActionError(null);
                              setArchiveError(null);
                              setPendingArchive(supplier);
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
            <span className="muted">{t('suppliers.showing', { count: rows.length, total })}</span>
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
        title={t('suppliers.archiveTitle')}
        description={
          pendingArchive === null
            ? ''
            : t('suppliers.archiveMessage', { name: pendingArchive.name })
        }
        confirmLabel={t('suppliers.confirmArchive')}
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
