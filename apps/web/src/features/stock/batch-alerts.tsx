'use client';

import { useCallback, useEffect, useState } from 'react';

import { useI18n } from '@/components/i18n-provider';
import { getBatchAlerts } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type { BatchAlerts } from '@/lib/types';

const DAY_OPTIONS = [7, 14, 30, 60, 90];

interface BatchAlertsProps {
  reloadKey: number;
}

export function BatchAlertsPanel({ reloadKey }: BatchAlertsProps) {
  const { t, locale } = useI18n();
  const [days, setDays] = useState(30);
  const [alerts, setAlerts] = useState<BatchAlerts | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      setAlerts(await getBatchAlerts(days));
    } catch (error) {
      setLoadError(getErrorMessage(t, error));
    } finally {
      setLoading(false);
    }
  }, [days, t]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  return (
    <section className="panel panel--flush" aria-labelledby="batch-alerts-title">
      <div className="toolbar toolbar--wrap">
        <div>
          <h3 id="batch-alerts-title" className="toolbar__title">
            {t('stock.alertsTitle')}
          </h3>
          <p className="muted">{t('stock.alertsSubtitle')}</p>
        </div>
        <div className="field">
          <label htmlFor="batch-alert-days">{t('stock.thresholdDays')}</label>
          <select
            id="batch-alert-days"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          >
            {DAY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t('stock.daysOption', { days: option })}
              </option>
            ))}
          </select>
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
          {[0, 1].map((row) => (
            <div key={row} className="skeleton-row">
              <span className="skeleton" />
              <span className="skeleton" />
              <span className="skeleton" />
            </div>
          ))}
        </div>
      ) : null}

      {!loading && loadError === null ? (
        <div className="panel__body alert-tables">
          <article>
            <h4 className="panel__subheading">{t('stock.nearExpiryTitle')}</h4>
            {alerts?.nearExpiry.length === 0 ? (
              <p className="muted">{t('stock.noNearExpiry')}</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('stock.tableProduct')}</th>
                      <th scope="col">{t('stock.tableBatch')}</th>
                      <th scope="col">{t('stock.tableExpiry')}</th>
                      <th scope="col">{t('stock.tableQuantity')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts?.nearExpiry.map((alert) => (
                      <tr key={alert.id}>
                        <td>
                          <div className="table-primary">
                            <strong>{alert.productName}</strong>
                            <small>{alert.productSku}</small>
                          </div>
                        </td>
                        <td>{alert.batchNumber}</td>
                        <td>
                          {formatDate(alert.expiryDate, locale)}
                          <small className="muted">
                            {' '}
                            {t('stock.daysLeft', { days: alert.daysToExpiry })}
                          </small>
                        </td>
                        <td>{alert.currentStockReadable}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article>
            <h4 className="panel__subheading">{t('stock.expiredTitle')}</h4>
            {alerts?.expired.length === 0 ? (
              <p className="muted">{t('stock.noExpired')}</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('stock.tableProduct')}</th>
                      <th scope="col">{t('stock.tableBatch')}</th>
                      <th scope="col">{t('stock.tableExpiry')}</th>
                      <th scope="col">{t('stock.tableQuantity')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts?.expired.map((alert) => (
                      <tr key={alert.id}>
                        <td>
                          <div className="table-primary">
                            <strong>{alert.productName}</strong>
                            <small>{alert.productSku}</small>
                          </div>
                        </td>
                        <td>{alert.batchNumber}</td>
                        <td>
                          {formatDate(alert.expiryDate, locale)}
                          <small className="muted">
                            {' '}
                            {t('stock.expiredDays', { days: Math.abs(alert.daysToExpiry) })}
                          </small>
                        </td>
                        <td>{alert.currentStockReadable}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </div>
      ) : null}
    </section>
  );
}
