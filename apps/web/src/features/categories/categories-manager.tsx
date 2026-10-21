'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { useI18n } from '@/components/i18n-provider';
import { Modal } from '@/components/modal';
import { archiveCategory, createCategory, listCategories, updateCategory } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type { Category, Paginated } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';

const PAGE_SIZE = 10;

type StatusFilter = '' | 'active' | 'archived';

export function CategoriesManager() {
  const { t, locale } = useI18n();
  const role = useSessionStore((state) => state.role);
  const canManage = role === 'OWNER' || role === 'STOCK_KEEPER';

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<Category> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [formName, setFormName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [pendingArchive, setPendingArchive] = useState<Category | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setLoading(true);
    setLoadError(null);

    try {
      const data = await listCategories({
        search,
        isActive: status === '' ? undefined : status === 'active',
        page,
        pageSize: PAGE_SIZE,
        sort: 'name',
        order: 'asc',
      });

      if (requestId.current === currentRequest) {
        setResult(data);
      }
    } catch (error) {
      if (requestId.current === currentRequest) {
        setLoadError(getErrorMessage(t, error));
      }
    } finally {
      if (requestId.current === currentRequest) {
        setLoading(false);
      }
    }
  }, [search, status, page, t]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const reload = () => setReloadKey((value) => value + 1);

  const openCreate = () => {
    setNotice(null);
    setEditing(null);
    setFormName('');
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (category: Category) => {
    setNotice(null);
    setEditing(category);
    setFormName(category.name);
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (!formBusy) {
      setFormOpen(false);
      setEditing(null);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = formName.trim();

    if (name.length < 2) {
      setFormError(t('validation.minLength', { min: 2 }));
      return;
    }

    if (name.length > 120) {
      setFormError(t('validation.maxLength', { max: 120 }));
      return;
    }

    setFormBusy(true);
    setFormError(null);

    try {
      if (editing === null) {
        await createCategory({ name });
        setNotice(t('categories.created'));
      } else {
        await updateCategory(editing.id, { name });
        setNotice(t('categories.updated'));
      }

      setFormOpen(false);
      setEditing(null);
      reload();
    } catch (error) {
      setFormError(getErrorMessage(t, error));
    } finally {
      setFormBusy(false);
    }
  };

  const confirmArchive = async () => {
    if (pendingArchive === null) {
      return;
    }

    setArchiveBusy(true);
    setArchiveError(null);

    try {
      await archiveCategory(pendingArchive.id);
      setPendingArchive(null);
      setNotice(t('categories.archived'));
      reload();
    } catch (error) {
      setArchiveError(getErrorMessage(t, error));
    } finally {
      setArchiveBusy(false);
    }
  };

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('active');
    setPage(1);
  };

  const rows = result?.data ?? [];
  const total = result?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersActive = search !== '' || status !== 'active';

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t('app.workspace')}</p>
          <h2>{t('categories.title')}</h2>
          <p className="muted">{t('categories.subtitle')}</p>
        </div>
        {canManage ? (
          <button type="button" className="button button--primary" onClick={openCreate}>
            {t('categories.add')}
          </button>
        ) : null}
      </section>

      {notice !== null ? (
        <p className="alert alert--success" role="status">
          {notice}
        </p>
      ) : null}

      <section className="panel panel--flush" aria-labelledby="category-list-title">
        <div className="toolbar toolbar--wrap">
          <h3 id="category-list-title" className="toolbar__title">
            {t('categories.title')}
          </h3>
          {filtersActive ? (
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={resetFilters}
            >
              {t('common.clear')}
            </button>
          ) : null}
        </div>

        <div className="catalog-filters catalog-filters--categories">
          <div className="field">
            <label htmlFor="category-search">{t('categories.search')}</label>
            <input
              id="category-search"
              value={searchInput}
              placeholder={t('categories.searchPlaceholder')}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="category-filter-status">{t('categories.filterStatus')}</label>
            <select
              id="category-filter-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as StatusFilter);
                setPage(1);
              }}
            >
              <option value="">{t('categories.all')}</option>
              <option value="active">{t('categories.active')}</option>
              <option value="archived">{t('categories.archivedLabel')}</option>
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
              <strong>
                {filtersActive ? t('categories.noResultsTitle') : t('categories.emptyTitle')}
              </strong>
              <p>{filtersActive ? t('categories.noResultsBody') : t('categories.emptyBody')}</p>
            </div>
          </div>
        ) : null}

        {!loading && loadError === null && rows.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{t('categories.tableName')}</th>
                  <th scope="col">{t('categories.tableStatus')}</th>
                  <th scope="col">{t('categories.tableCreated')}</th>
                  {canManage ? (
                    <th scope="col" className="data-table__actions">
                      {t('categories.tableActions')}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <span className="table-primary">
                        <strong>{category.name}</strong>
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-badge ${
                          category.isActive ? 'status-badge--approved' : 'status-badge--inactive'
                        }`}
                      >
                        <span className="status-badge__dot" aria-hidden="true" />
                        {category.isActive ? t('categories.active') : t('categories.archivedLabel')}
                      </span>
                    </td>
                    <td>{formatDate(category.createdAt, locale)}</td>
                    {canManage ? (
                      <td className="data-table__actions">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="button button--small button--secondary"
                            onClick={() => openEdit(category)}
                          >
                            {t('common.edit')}
                          </button>
                          {category.isActive ? (
                            <button
                              type="button"
                              className="button button--small button--danger-ghost"
                              onClick={() => {
                                setArchiveError(null);
                                setPendingArchive(category);
                              }}
                            >
                              {t('common.archive')}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && loadError === null ? (
          <div className="pagination">
            <span className="muted">{t('categories.showing', { count: rows.length, total })}</span>
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

      <Modal
        open={formOpen}
        title={editing === null ? t('categories.newTitle') : t('categories.editTitle')}
        busy={formBusy}
        onClose={closeForm}
      >
        <form className="form" onSubmit={submit} noValidate>
          {formError !== null ? (
            <p className="alert alert--error" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="field">
            <label htmlFor="category-name">{t('categories.name')}</label>
            <input
              id="category-name"
              value={formName}
              maxLength={120}
              placeholder={t('categories.namePlaceholder')}
              aria-invalid={formError !== null}
              onChange={(event) => {
                setFormName(event.target.value);
                setFormError(null);
              }}
              disabled={formBusy}
            />
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={closeForm}
              disabled={formBusy}
            >
              {t('common.cancel')}
            </button>
            <button type="submit" className="button button--primary" disabled={formBusy}>
              {formBusy
                ? editing === null
                  ? t('categories.creating')
                  : t('categories.saving')
                : editing === null
                  ? t('categories.create')
                  : t('categories.save')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingArchive !== null}
        title={t('categories.archiveTitle')}
        description={
          pendingArchive === null
            ? ''
            : t('categories.archiveMessage', { name: pendingArchive.name })
        }
        confirmLabel={t('categories.confirmArchive')}
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
