'use client';

import { useCallback, useEffect, useState } from 'react';

import { useI18n } from '@/components/i18n-provider';
import { listStockMovements } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type { Paginated, Product, StockMovement, StockMovementType } from '@/lib/types';
import { STOCK_MOVEMENT_TYPES } from '@/lib/types';

const PAGE_SIZE = 20;

interface MovementHistoryProps {
  products: Product[];
  reloadKey: number;
}

export function MovementHistory({ products, reloadKey }: MovementHistoryProps) {
  const { t, locale } = useI18n();
  const [productId, setProductId] = useState('');
  const [type, setType] = useState<StockMovementType | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<StockMovement> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const data = await listStockMovements({
        productId: productId === '' ? undefined : productId,
        type: type === '' ? undefined : type,
        from: from === '' ? undefined : new Date(`${from}T00:00:00.000Z`).toISOString(),
        to: to === '' ? undefined : new Date(`${to}T23:59:59.999Z`).toISOString(),
        page,
        pageSize: PAGE_SIZE,
      });
      setResult(data);
    } catch (error) {
      setLoadError(getErrorMessage(t, error));
    } finally {
      setLoading(false);
    }
  }, [productId, type, from, to, page, t]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const rows = result?.data ?? [];
  const total = result?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const resetFilters = () => {
    setProductId('');
    setType('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  return (
    <section className="panel panel--flush" aria-labelledby="movement-history-title">
      <div className="toolbar toolbar--wrap">
        <h3 id="movement-history-title" className="toolbar__title">
          {t('stock.historyTitle')}
        </h3>
        <p className="muted">{t('stock.historySubtitle')}</p>
      </div>

      <div className="catalog-filters">
        <div className="field">
          <label htmlFor="movement-product">{t('stock.filterProduct')}</label>
          <select
            id="movement-product"
            value={productId}
            onChange={(event) => {
              setProductId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('stock.allProducts')}</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.sku})
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="movement-type">{t('stock.filterType')}</label>
          <select
            id="movement-type"
            value={type}
            onChange={(event) => {
              setType(event.target.value as StockMovementType | '');
              setPage(1);
            }}
          >
            <option value="">{t('stock.allTypes')}</option>
            {STOCK_MOVEMENT_TYPES.map((movementType) => (
              <option key={movementType} value={movementType}>
                {t(`stockMovementTypes.${movementType}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="movement-from">{t('stock.filterFrom')}</label>
          <input
            id="movement-from"
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="field">
          <label htmlFor="movement-to">{t('stock.filterTo')}</label>
          <input
            id="movement-to"
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="field">
          <span className="visually-hidden">{t('common.clear')}</span>
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={resetFilters}
          >
            {t('common.clear')}
          </button>
        </div>
      </div>

      {loadError !== null ? (
        <div className="panel__body">
          <p className="alert alert--error" role="alert">
            {loadError}
          </p>
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
        <div className="empty-state">
          <div>
            <strong>{t('stock.historyEmptyTitle')}</strong>
            <p>{t('stock.historyEmptyBody')}</p>
          </div>
        </div>
      ) : null}

      {!loading && loadError === null && rows.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table product-table">
            <thead>
              <tr>
                <th scope="col">{t('stock.tableDate')}</th>
                <th scope="col">{t('stock.tableProduct')}</th>
                <th scope="col">{t('stock.tableType')}</th>
                <th scope="col">{t('stock.tableQuantity')}</th>
                <th scope="col">{t('stock.tableWho')}</th>
                <th scope="col">{t('stock.tableWhy')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((movement) => (
                <tr key={movement.id}>
                  <td>{formatDate(movement.createdAt, locale)}</td>
                  <td>
                    <div className="table-primary">
                      <strong>{movement.product.name}</strong>
                      <small>{movement.product.sku}</small>
                    </div>
                  </td>
                  <td>{t(`stockMovementTypes.${movement.type}`)}</td>
                  <td>{movement.quantityReadable}</td>
                  <td>{movement.createdBy?.name ?? t('common.unknown')}</td>
                  <td>
                    <div className="table-primary">
                      <span>{movement.reason ?? t('stock.noReason')}</span>
                      {movement.batch === null ? null : (
                        <small>{t('stock.batchRow', { batch: movement.batch.batchNumber })}</small>
                      )}
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
          <span className="muted">{t('stock.historyShowing', { count: rows.length, total })}</span>
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
