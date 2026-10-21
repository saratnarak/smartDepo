'use client';

import { useCallback, useEffect, useState } from 'react';

import { useI18n } from '@/components/i18n-provider';
import { listProducts, listStock } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import type { Product, StockItem } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';
import { BatchAlertsPanel } from './batch-alerts';
import { MovementHistory } from './movement-history';
import { StockMovementForm } from './stock-movement-form';
import { StockTable } from './stock-table';

export function StockManager() {
  const { t } = useI18n();
  const role = useSessionStore((state) => state.role);
  const canManage = role === 'OWNER' || role === 'STOCK_KEEPER';

  const [reloadKey, setReloadKey] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;

    void Promise.all([
      listProducts({ pageSize: 100, isActive: true, sort: 'name', order: 'asc' }),
      listStock({ pageSize: 100, isActive: true, sort: 'name', order: 'asc' }),
    ])
      .then(([productPage, stockPage]) => {
        if (active) {
          setProducts(productPage.data);
          setStockItems(stockPage.data);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(getErrorMessage(t, error));
        }
      });

    return () => {
      active = false;
    };
  }, [reloadKey, t]);

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t('app.workspace')}</p>
          <h2>{t('stock.title')}</h2>
          <p className="muted">{t('stock.subtitle')}</p>
        </div>
      </section>

      {loadError !== null ? (
        <p className="alert alert--error" role="alert">
          {loadError}
        </p>
      ) : null}

      {!canManage ? <p className="alert alert--info">{t('stock.readOnlyNote')}</p> : null}

      <StockTable reloadKey={reloadKey} onChanged={reload} />

      {canManage ? (
        <StockMovementForm
          stockItems={stockItems}
          onRecorded={() => {
            reload();
          }}
        />
      ) : null}

      <BatchAlertsPanel reloadKey={reloadKey} />

      <MovementHistory products={products} reloadKey={reloadKey} />
    </div>
  );
}
