'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';

import { useI18n } from '@/components/i18n-provider';
import { listStock, listLowStock } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type { Paginated, StockItem } from '@/lib/types';

const PAGE_SIZE = 20;

export type StockFilter = 'all' | 'low';

interface StockTableProps {
  reloadKey: number;
  onChanged: () => void;
}

export function StockTable({ reloadKey, onChanged }: StockTableProps) {
  const { t, locale } = useI18n();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<StockItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      const params = { search, page, pageSize: PAGE_SIZE };
      const data = filter === 'low' ? await listLowStock(params) : await listStock(params);
      setResult(data);
    } catch (error) {
      setLoadError(getErrorMessage(t, error));
    } finally {
      setLoading(false);
    }
  }, [filter, search, page, t]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const rows = result?.data ?? [];
  const total = result?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const lowStockCount = rows.filter((row) => row.lowStock).length;

  return (
    <section className="panel panel--flush" aria-labelledby="stock-table-title">
      <div className="toolbar toolbar--wrap">
        <h3 id="stock-table-title" className="toolbar__title">
          {t('stock.tableTitle')}
        </h3>
        <div className="filter-tabs" role="group" aria-label={t('stock.filterLabel')}>
          <button
            type="button"
            className={`filter-tab${filter === 'all' ? ' filter-tab--active' : ''}`}
            aria-pressed={filter === 'all'}
            onClick={() => {
              setFilter('all');
              setPage(1);
            }}
          >
            {t('stock.filterAll')}
          </button>
          <button
            type="button"
            className={`filter-tab${filter === 'low' ? ' filter-tab--active' : ''}`}
            aria-pressed={filter === 'low'}
            onClick={() => {
              setFilter('low');
              setPage(1);
            }}
          >
            {t('stock.filterLowStock')}
          </button>
        </div>
      </div>

      <div className="catalog-filters">
        <div className="field">
          <label htmlFor="stock-search">{t('stock.search')}</label>
          <input
            id="stock-search"
            value={searchInput}
            placeholder={t('stock.searchPlaceholder')}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
      </div>

      {loadError !== null ? (
        <div className="panel__body">
          <p className="alert alert--error" role="alert">
            {loadError}
          </p>
          <button type="button" className="button button--secondary" onClick={onChanged}>
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
            <strong>{filter === 'low' ? t('stock.noLowStockTitle') : t('stock.emptyTitle')}</strong>
            <p>{filter === 'low' ? t('stock.noLowStockBody') : t('stock.emptyBody')}</p>
          </div>
        </div>
      ) : null}

      {!loading && loadError === null && rows.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table product-table">
            <thead>
              <tr>
                <th scope="col">{t('stock.tableProduct')}</th>
                <th scope="col">{t('stock.tableCurrentStock')}</th>
                <th scope="col">{t('stock.tableBaseUnits')}</th>
                <th scope="col">{t('stock.tableStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <Fragment key={item.id}>
                  <tr>
                    <td>
                      <div className="table-primary">
                        <strong>{item.name}</strong>
                        <small>{item.sku}</small>
                      </div>
                    </td>
                    <td>{item.currentStockReadable}</td>
                    <td>
                      <div className="table-primary">
                        <span>{item.currentStock}</span>
                        <small>{item.baseUnit.name}</small>
                      </div>
                    </td>
                    <td>
                      <div className="product-table__status">
                        <span
                          className={`status-badge ${
                            item.lowStock ? 'status-badge--pending' : 'status-badge--approved'
                          }`}
                        >
                          <span className="status-badge__dot" aria-hidden="true" />
                          {item.lowStock ? t('stock.lowStock') : t('stock.stockOk')}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {item.batches.map((batch) => (
                    <tr key={`${item.id}-${batch.id}`} className="stock-batch-row">
                      <td>
                        <div className="table-primary">
                          <span>{t('stock.batchRow', { batch: batch.batchNumber })}</span>
                          <small>
                            {batch.expiryDate === null
                              ? t('stock.noExpiry')
                              : t('stock.batchExpiry', {
                                  date: formatDate(batch.expiryDate, locale),
                                })}
                          </small>
                        </div>
                      </td>
                      <td>{batch.currentStockReadable}</td>
                      <td>
                        <div className="table-primary">
                          <span>{batch.currentStock}</span>
                          <small>{item.baseUnit.name}</small>
                        </div>
                      </td>
                      <td>{t('stock.batchStock')}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && loadError === null ? (
        <div className="pagination">
          <span className="muted">
            {t('stock.showing', { count: rows.length, total })}
            {filter === 'all' && lowStockCount > 0
              ? ` · ${t('stock.lowStockCount', { count: lowStockCount })}`
              : ''}
          </span>
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
  );
}
