'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import { useI18n } from '@/components/i18n-provider';
import { getPlatformDashboard } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type { PlatformDashboard } from '@/lib/types';
import { ChartPanel, EmptyChart, HorizontalBarChart } from '@/features/dashboard/dashboard-charts';
import type { ChartDatum } from '@/features/dashboard/chart-data';

/**
 * The dashboard of the platform (FR-5). Only the Platform Admin reaches it, and the API is the
 * real guard: a depot user gets 403 from the endpoint.
 */
export function PlatformDashboardManager() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<PlatformDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    getPlatformDashboard()
      .then((result) => {
        if (active) {
          setData(result);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(getErrorMessage(t, caught));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [reloadKey, t]);

  const registrations: ChartDatum[] =
    data?.registeredOverTime.map((point) => ({
      key: point.period,
      label: point.period,
      value: point.registered,
      display: String(point.registered),
    })) ?? [];

  const plans: ChartDatum[] =
    data?.depotsByPlan.map((point) => ({
      key: point.plan,
      label: point.plan,
      value: point.depots,
      display: String(point.depots),
    })) ?? [];

  if (loading) {
    return (
      <div className="page-stack">
        <section className="page-heading">
          <div>
            <p className="eyebrow">{t('platformDashboard.eyebrow')}</p>
            <h2>{t('platformDashboard.title')}</h2>
          </div>
        </section>
        <div className="kpi-grid" role="status" aria-live="polite">
          <span className="visually-hidden">{t('common.loading')}</span>
          {[0, 1, 2].map((index) => (
            <div key={index} className="kpi-card kpi-card--skeleton">
              <span className="skeleton" />
              <span className="skeleton" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error !== null) {
    return (
      <div className="page-stack">
        <section className="page-heading">
          <div>
            <p className="eyebrow">{t('platformDashboard.eyebrow')}</p>
            <h2>{t('platformDashboard.title')}</h2>
          </div>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            {t('common.retry')}
          </button>
        </section>
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t('platformDashboard.eyebrow')}</p>
          <h2>{t('platformDashboard.title')}</h2>
          <p className="muted">{t('platformDashboard.subtitle')}</p>
        </div>
        <button
          type="button"
          className="icon-button refresh-button"
          aria-label={t('common.refresh')}
          title={t('common.refresh')}
          onClick={() => setReloadKey((value) => value + 1)}
          disabled={loading}
        >
          <span aria-hidden="true">↻</span>
        </button>
      </section>

      <section className="kpi-grid" aria-label={t('platformDashboard.cards')}>
        <article className="kpi-card">
          <span className="kpi-card__label">{t('platformDashboard.totalDepots')}</span>
          <strong className="kpi-card__value">{data?.totalDepots ?? 0}</strong>
        </article>
        <article className="kpi-card">
          <span className="kpi-card__label">{t('platformDashboard.activeDepots')}</span>
          <strong className="kpi-card__value">{data?.activeDepots ?? 0}</strong>
        </article>
        <article className="kpi-card">
          <span className="kpi-card__label">{t('platformDashboard.pendingApprovals')}</span>
          <strong className="kpi-card__value">{data?.pendingApprovals ?? 0}</strong>
          <Link href="/platform/depots" className="kpi-card__link">
            {t('platformDashboard.openApprovals')}
          </Link>
        </article>
      </section>

      <div className="chart-grid">
        <ChartPanel
          title={t('platformDashboard.chartRegistrations')}
          href="/platform/depots"
          linkLabel={t('platformDashboard.openApprovals')}
        >
          {registrations.length === 0 ? (
            <EmptyChart label={t('platformDashboard.noData')} />
          ) : (
            <HorizontalBarChart data={registrations} currency="" locale={locale} format="number" />
          )}
        </ChartPanel>

        <ChartPanel
          title={t('platformDashboard.chartPlans')}
          href="/platform/depots"
          linkLabel={t('platformDashboard.openApprovals')}
        >
          {plans.length === 0 ? (
            <EmptyChart label={t('platformDashboard.noData')} />
          ) : (
            <HorizontalBarChart data={plans} currency="" locale={locale} format="number" />
          )}
        </ChartPanel>
      </div>

      <section className="panel panel--flush" aria-labelledby="platform-pending-title">
        <div className="toolbar">
          <h3 id="platform-pending-title" className="toolbar__title">
            {t('platformDashboard.pendingTitle')}
          </h3>
          <Link href="/platform/depots" className="button button--secondary button--small">
            {t('platformDashboard.openApprovals')}
          </Link>
        </div>

        {data === null || data.pendingDepots.length === 0 ? (
          <div className="empty-state empty-state--large">
            <span className="empty-state__mark" aria-hidden="true">
              0
            </span>
            <div>
              <strong>{t('platformDashboard.noPendingTitle')}</strong>
              <p>{t('platformDashboard.noPendingBody')}</p>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table report-table">
              <caption className="visually-hidden">{t('platformDashboard.pendingTitle')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('platform.depot')}</th>
                  <th scope="col">{t('platform.createdAt')}</th>
                  <th scope="col" className="report-table__number">
                    {t('platformDashboard.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.pendingDepots.map((depot) => (
                  <tr key={depot.depotId}>
                    <td>
                      <div className="table-primary">
                        <strong>{depot.name}</strong>
                      </div>
                    </td>
                    <td>{formatDate(depot.createdAt, locale)}</td>
                    <td className="report-table__number">
                      <Link
                        href="/platform/depots"
                        className="button button--small button--primary"
                      >
                        {t('platformDashboard.review')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
