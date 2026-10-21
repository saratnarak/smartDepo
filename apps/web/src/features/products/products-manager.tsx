'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { useI18n } from '@/components/i18n-provider';
import {
  archiveProduct,
  getDepotSettings,
  getProduct,
  listCategories,
  listProducts,
  type ProductSort,
} from '@/lib/api-client';
import { formatReadableQuantity } from '@/lib/decimal';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/format';
import type { Category, Paginated, Product } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';
import { ProductForm } from './product-form';

const PAGE_SIZE = 10;

type StatusFilter = '' | 'active' | 'archived';

export function ProductsManager() {
  const { t, locale } = useI18n();
  const role = useSessionStore((state) => state.role);
  const canManage = role === 'OWNER' || role === 'STOCK_KEEPER';
  const canListCategories = canManage;

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [sort, setSort] = useState<ProductSort>('name');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<Product> | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currency, setCurrency] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [pendingArchive, setPendingArchive] = useState<Product | null>(null);
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

  const loadProducts = useCallback(async () => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setLoading(true);
    setLoadError(null);

    try {
      const data = await listProducts({
        search,
        categoryId,
        isActive: status === '' ? undefined : status === 'active',
        page,
        pageSize: PAGE_SIZE,
        sort,
        order,
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
  }, [search, categoryId, status, page, sort, order, t]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts, reloadKey]);

  useEffect(() => {
    let active = true;

    void getDepotSettings()
      .then((settings) => {
        if (active) {
          setCurrency(settings.currency);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!canListCategories) {
      return;
    }

    let active = true;

    void listCategories({ pageSize: 100, sort: 'name', order: 'asc' })
      .then((data) => {
        if (active) {
          setCategories(data.data);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [canListCategories, reloadKey]);

  const reload = () => {
    setReloadKey((value) => value + 1);
  };

  const money = (amount: string) =>
    currency === '' ? amount : formatMoney(amount, currency, locale, { decimals: 2 });
  const currencyLabel = currency === '' ? '—' : currency;

  const priceFor = (product: Product, type: 'RETAIL' | 'WHOLESALE'): string | null => {
    const price = product.baseUnit.prices.find((entry) => entry.type === type);
    return price?.amount ?? null;
  };

  const categoryOptions = useMemo(() => {
    if (canListCategories) {
      return categories;
    }

    const seen = new Map<string, Category>();

    for (const product of result?.data ?? []) {
      if (product.category !== null && !seen.has(product.category.id)) {
        seen.set(product.category.id, {
          id: product.category.id,
          name: product.category.name,
          isActive: product.category.isActive,
          createdAt: '',
          updatedAt: '',
        });
      }
    }

    return [...seen.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [canListCategories, categories, result]);

  const openCreate = () => {
    setNotice(null);
    setActionError(null);
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (product: Product) => {
    setNotice(null);
    setActionError(null);
    setEditing(product);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const saved = (product: Product) => {
    if (editing === null) {
      setNotice(t('products.created'));
      setEditing(product);
      setFormOpen(true);
    } else {
      setNotice(t('products.updated'));
      setEditing(product);
    }

    reload();
  };

  const refreshEditing = async (): Promise<Product | null> => {
    if (editing === null) {
      return null;
    }

    try {
      const fresh = await getProduct(editing.id);
      setEditing(fresh);
      reload();
      return fresh;
    } catch (error) {
      setActionError(getErrorMessage(t, error));
      return null;
    }
  };

  const confirmArchive = async () => {
    if (pendingArchive === null) {
      return;
    }

    setArchiveBusy(true);
    setArchiveError(null);

    try {
      await archiveProduct(pendingArchive.id);
      setPendingArchive(null);
      setNotice(t('products.archived'));
      if (editing?.id === pendingArchive.id) {
        closeForm();
      }
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
    setCategoryId('');
    setStatus('active');
    setSort('name');
    setOrder('asc');
    setPage(1);
  };

  const rows = result?.data ?? [];
  const total = result?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersActive =
    search !== '' || categoryId !== '' || status !== 'active' || sort !== 'name' || order !== 'asc';

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t('app.workspace')}</p>
          <h2>{t('products.title')}</h2>
          <p className="muted">{t('products.subtitle')}</p>
        </div>
        {canManage ? (
          <button type="button" className="button button--primary" onClick={openCreate}>
            {t('products.add')}
          </button>
        ) : null}
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
        <ProductForm
          key={editing?.id ?? 'new'}
          product={editing}
          categories={categoryOptions}
          currency={currency}
          onSaved={saved}
          onCancel={closeForm}
          onRefresh={refreshEditing}
          onNotify={setNotice}
        />
      ) : null}

      <section className="panel panel--flush" aria-labelledby="product-list-title">
        <div className="toolbar toolbar--wrap">
          <h3 id="product-list-title" className="toolbar__title">
            {t('products.title')}
          </h3>
          {filtersActive ? (
            <button
              type="button"
              className="button button--quiet button--small"
              onClick={resetFilters}
            >
              {t('common.clear')}
            </button>
          ) : null}
        </div>

        <div className="catalog-filters">
          <div className="field">
            <label htmlFor="product-search">{t('products.search')}</label>
            <input
              id="product-search"
              value={searchInput}
              placeholder={t('products.searchPlaceholder')}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="product-filter-category">{t('products.filterCategory')}</label>
            <select
              id="product-filter-category"
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('products.allCategories')}</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.isActive ? '' : ` (${t('products.archivedLabel')})`}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="product-filter-status">{t('products.filterStatus')}</label>
            <select
              id="product-filter-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as StatusFilter);
                setPage(1);
              }}
            >
              <option value="">{t('products.allStatuses')}</option>
              <option value="active">{t('products.active')}</option>
              <option value="archived">{t('products.archivedLabel')}</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="product-sort">{t('products.sort')}</label>
            <select
              id="product-sort"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as ProductSort);
                setPage(1);
              }}
            >
              <option value="name">{t('products.sortName')}</option>
              <option value="sku">{t('products.sortSku')}</option>
              <option value="createdAt">{t('products.sortCreated')}</option>
              <option value="reorderLevel">{t('products.sortReorder')}</option>
              <option value="isActive">{t('products.sortStatus')}</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="product-order">{t('products.order')}</label>
            <select
              id="product-order"
              value={order}
              onChange={(event) => {
                setOrder(event.target.value === 'desc' ? 'desc' : 'asc');
                setPage(1);
              }}
            >
              <option value="asc">{t('products.orderAsc')}</option>
              <option value="desc">{t('products.orderDesc')}</option>
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
              <strong>
                {filtersActive ? t('products.noResultsTitle') : t('products.emptyTitle')}
              </strong>
              <p>{filtersActive ? t('products.noResultsBody') : t('products.emptyBody')}</p>
            </div>
          </div>
        ) : null}

        {!loading && loadError === null && rows.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table product-table">
              <thead>
                <tr>
                  <th scope="col">{t('products.tableProduct')}</th>
                  <th scope="col">{t('products.tableCategory')}</th>
                  <th scope="col">{t('products.tableUnits')}</th>
                  <th scope="col">{t('products.tableReorder')}</th>
                  <th scope="col">{t('products.tableStock')}</th>
                  <th scope="col">{t('products.tableCostPrice', { currency: currencyLabel })}</th>
                  <th scope="col">{t('products.tableRetail', { currency: currencyLabel })}</th>
                  <th scope="col">{t('products.tableWholesale', { currency: currencyLabel })}</th>
                  <th scope="col">{t('products.tableStatus')}</th>
                  {canManage ? (
                    <th scope="col" className="data-table__actions">
                      {t('products.tableActions')}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((product) => {
                  const retail = priceFor(product, 'RETAIL');
                  const wholesale = priceFor(product, 'WHOLESALE');
                  const low = product.lowStock;

                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="table-primary">
                          <strong>{product.name}</strong>
                          <small>{product.sku}</small>
                        </div>
                      </td>
                      <td>{product.category?.name ?? t('products.categoryPlaceholder')}</td>
                      <td>
                        <div className="table-primary">
                          <span>{product.baseUnit.name}</span>
                          <small>
                            {product.units
                              .filter((unit) => unit.isActive)
                              .map((unit) => unit.name)
                              .join(', ')}
                          </small>
                        </div>
                      </td>
                      <td>
                        <span>
                          {formatReadableQuantity(product.reorderLevel, product.units, {
                            conjunction: t('products.quantityAnd'),
                            pluralize: locale === 'en',
                          })}
                        </span>
                      </td>
                      <td>
                        <div className="table-primary">
                          <span>{product.currentStockReadable}</span>
                          <small>
                            {product.currentStock} {product.baseUnit.name}
                          </small>
                        </div>
                      </td>
                      <td>{money(product.costPrice)}</td>
                      <td>{retail === null ? t('products.notSet') : money(retail)}</td>
                      <td>{wholesale === null ? t('products.notSet') : money(wholesale)}</td>
                      <td>
                        <div className="product-table__status">
                          <span
                            className={`status-badge ${
                              product.isActive ? 'status-badge--approved' : 'status-badge--inactive'
                            }`}
                          >
                            <span className="status-badge__dot" aria-hidden="true" />
                            {product.isActive ? t('products.active') : t('products.archivedLabel')}
                          </span>
                          {low ? (
                            <span className="status-badge status-badge--pending">
                              <span className="status-badge__dot" aria-hidden="true" />
                              {t('products.lowStock')}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      {canManage ? (
                        <td className="data-table__actions">
                          <div className="row-actions">
                            <button
                              type="button"
                              className="button button--small button--secondary"
                              onClick={() => openEdit(product)}
                            >
                              {t('common.edit')}
                            </button>
                            {product.isActive ? (
                              <button
                                type="button"
                                className="button button--small button--danger-ghost"
                                onClick={() => {
                                  setActionError(null);
                                  setArchiveError(null);
                                  setPendingArchive(product);
                                }}
                              >
                                {t('common.archive')}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && loadError === null ? (
          <div className="pagination">
            <span className="muted">{t('products.showing', { count: rows.length, total })}</span>
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
        title={t('products.archiveTitle')}
        description={
          pendingArchive === null ? '' : t('products.archiveMessage', { name: pendingArchive.name })
        }
        confirmLabel={t('products.confirmArchive')}
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
