'use client';

import { useCallback, useEffect, useState } from 'react';

import { useI18n } from '@/components/i18n-provider';
import { listPriceHistory } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { formatDate, formatMoney } from '@/lib/format';
import type { PriceHistoryEntry, Product } from '@/lib/types';

interface PriceHistoryTableProps {
  product: Product;
  currency: string;
}

export function PriceHistoryTable({ product, currency }: PriceHistoryTableProps) {
  const { t, locale } = useI18n();
  const [entries, setEntries] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const units = product.units.filter((unit) => unit.isActive);
      const pages = await Promise.all(
        units.map((unit) => listPriceHistory(product.id, unit.id, { pageSize: 50 })),
      );
      const merged = pages
        .flatMap((page) => page.data)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      setEntries(merged);
    } catch (error) {
      setLoadError(getErrorMessage(t, error));
    } finally {
      setLoading(false);
    }
  }, [product.id, product.units, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const money = (amount: string) =>
    currency === '' ? amount : formatMoney(amount, currency, locale, { decimals: 2 });

  return (
    <div className="price-history">
      <h4>{t('products.priceHistory')}</h4>
      <p className="muted">{t('products.priceHistorySubtitle')}</p>

      {loadError !== null ? (
        <p className="alert alert--error" role="alert">
          {loadError}
        </p>
      ) : null}

      {loading ? <p className="muted">{t('common.loading')}</p> : null}

      {!loading && loadError === null && entries.length === 0 ? (
        <p className="muted">{t('products.priceHistoryEmpty')}</p>
      ) : null}

      {!loading && loadError === null && entries.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table product-table">
            <thead>
              <tr>
                <th scope="col">{t('products.priceHistoryUnit')}</th>
                <th scope="col">{t('products.priceHistoryType')}</th>
                <th scope="col">{t('products.priceHistoryOld')}</th>
                <th scope="col">{t('products.priceHistoryNew')}</th>
                <th scope="col">{t('products.priceHistoryWho')}</th>
                <th scope="col">{t('products.priceHistoryWhen')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.productUnitName}</td>
                  <td>{t(`prices.${entry.type}`)}</td>
                  <td className="money">
                    {entry.oldAmount === null ? '—' : money(entry.oldAmount)}
                  </td>
                  <td className="money">{money(entry.newAmount)}</td>
                  <td>{entry.changedBy?.name ?? t('common.unknown')}</td>
                  <td>{formatDate(entry.createdAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
