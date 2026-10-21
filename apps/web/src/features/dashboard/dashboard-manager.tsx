'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import { useI18n } from '@/components/i18n-provider';
import { getDashboard, getDepotSettings, getSalesReport } from '@/lib/api-client';
import { addDays, depotToday } from '@/lib/depot-dates';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/format';
import { PERMISSIONS, roleHasPermission } from '@/lib/permissions';
import type { Dashboard, ReportUnit, UserRole } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';
import {
  AgeingChart,
  ChartPanel,
  EmptyChart,
  HorizontalBarChart,
  PurchasesVersusSalesChart,
  SalesTrendChart,
  WeekdayChart,
} from './dashboard-charts';
import {
  ageingData,
  categoryData,
  customerBalanceData,
  customerSalesData,
  productQuantityData,
  productRevenueData,
  purchasesVersusSalesData,
  salesTrendData,
  slowMovingData,
  weekdayData,
  type ChartDatum,
} from './chart-data';

const TREND_RANGES: Record<'day' | 'week' | 'month', number> = {
  day: 13,
  week: 83,
  month: 179,
};

interface KpiCard {
  key: string;
  labelKey: string;
  value: string;
  href: string;
}

function usePermissions(role: UserRole) {
  return useMemo(
    () => ({
      sales: roleHasPermission(role, PERMISSIONS.REPORTS_SALES),
      full: roleHasPermission(role, PERMISSIONS.REPORTS_FULL),
      inventory: roleHasPermission(role, PERMISSIONS.REPORTS_INVENTORY),
      purchases: roleHasPermission(role, PERMISSIONS.REPORTS_PURCHASES),
    }),
    [role],
  );
}

/**
 * The dashboard of the depot (FR-49). The API sends the part of the data that the role of the
 * caller may see, and this screen shows the same parts: the sales staff get the sales cards and
 * the trend, the stock keeper the inventory cards and the slow-moving stock, and the owner
 * everything.
 */
export function DashboardManager() {
  const { t, locale } = useI18n();
  const role = useSessionStore((state) => state.role) ?? ('OWNER' as UserRole);
  const permissions = usePermissions(role);
  const [data, setData] = useState<Dashboard | null>(null);
  const [trend, setTrend] = useState<ChartDatum[]>([]);
  const [trendUnit, setTrendUnit] = useState<'day' | 'week' | 'month'>('day');
  const [currency, setCurrency] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    Promise.all([getDashboard(), getDepotSettings()])
      .then(([dashboard, settings]) => {
        if (active) {
          setData(dashboard);
          setCurrency(settings.currency);
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

  useEffect(() => {
    let active = true;
    const today = depotToday();
    const to = today;
    const from = addDays(today, -TREND_RANGES[trendUnit]);

    getSalesReport({ from, to, unit: trendUnit as ReportUnit })
      .then((report) => {
        if (active) {
          setTrend(salesTrendData(report.rows));
        }
      })
      .catch(() => {
        if (active) {
          setTrend([]);
        }
      });

    return () => {
      active = false;
    };
  }, [trendUnit]);

  const kpis = data === null ? [] : buildKpis(data, permissions, currency, locale);

  if (loading) {
    return (
      <div className="page-stack">
        <section className="page-heading">
          <div>
            <p className="eyebrow">{t('dashboard.eyebrow')}</p>
            <h2>{t('dashboard.title')}</h2>
          </div>
        </section>
        <div className="kpi-grid" role="status" aria-live="polite">
          <span className="visually-hidden">{t('common.loading')}</span>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="kpi-card kpi-card--skeleton">
              <span className="skeleton" />
              <span className="skeleton" />
            </div>
          ))}
        </div>
        <div className="chart-grid">
          {[0, 1].map((index) => (
            <div key={index} className="panel chart-panel">
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
            <p className="eyebrow">{t('dashboard.eyebrow')}</p>
            <h2>{t('dashboard.title')}</h2>
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

  const charts = data?.charts;

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t('dashboard.eyebrow')}</p>
          <h2>{t('dashboard.title')}</h2>
          <p className="muted">{t('dashboard.subtitle')}</p>
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

      {kpis.length > 0 ? (
        <section className="kpi-grid" aria-label={t('dashboard.cards')}>
          {kpis.map((kpi) => (
            <Link key={kpi.key} href={kpi.href} className="kpi-card">
              <span className="kpi-card__label">{t(kpi.labelKey)}</span>
              <strong className="kpi-card__value">{kpi.value}</strong>
              <span className="kpi-card__link">{t('dashboard.openReport')}</span>
            </Link>
          ))}
        </section>
      ) : null}

      {permissions.sales ? (
        <ChartPanel
          title={t('dashboard.chartSalesTrend')}
          href="/reports/sales"
          linkLabel={t('dashboard.openReport')}
        >
          <div
            className="filter-tabs chart-panel__tabs"
            role="group"
            aria-label={t('reports.unit')}
          >
            {(['day', 'week', 'month'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={`filter-tab${trendUnit === option ? ' filter-tab--active' : ''}`}
                aria-pressed={trendUnit === option}
                onClick={() => setTrendUnit(option)}
              >
                {t(`reports.unit.${option}`)}
              </button>
            ))}
          </div>
          {trend.length === 0 ? (
            <EmptyChart label={t('dashboard.noData')} />
          ) : (
            <SalesTrendChart data={trend} currency={currency} locale={locale} />
          )}
        </ChartPanel>
      ) : null}

      {permissions.full && charts !== undefined ? (
        <>
          <div className="chart-grid">
            <ChartPanel
              title={t('dashboard.chartTopRevenue')}
              href="/reports/sales?view=product"
              linkLabel={t('dashboard.openReport')}
            >
              {charts.topProductsByRevenue.length === 0 ? (
                <EmptyChart label={t('dashboard.noData')} />
              ) : (
                <HorizontalBarChart
                  data={productRevenueData(charts.topProductsByRevenue)}
                  currency={currency}
                  locale={locale}
                />
              )}
            </ChartPanel>

            <ChartPanel
              title={t('dashboard.chartTopQuantity')}
              href="/reports/sales?view=product"
              linkLabel={t('dashboard.openReport')}
            >
              {charts.topProductsByQuantity.length === 0 ? (
                <EmptyChart label={t('dashboard.noData')} />
              ) : (
                <HorizontalBarChart
                  data={productQuantityData(charts.topProductsByQuantity)}
                  currency={currency}
                  locale={locale}
                  format="number"
                />
              )}
            </ChartPanel>
          </div>

          <ChartPanel
            title={t('dashboard.chartCategories')}
            href="/reports/sales?view=category"
            linkLabel={t('dashboard.openReport')}
          >
            {charts.salesByCategory.length === 0 ? (
              <EmptyChart label={t('dashboard.noData')} />
            ) : (
              <HorizontalBarChart
                data={categoryData(charts.salesByCategory)}
                currency={currency}
                locale={locale}
              />
            )}
          </ChartPanel>

          <div className="chart-grid">
            <ChartPanel
              title={t('dashboard.chartTopCustomers')}
              href="/reports/sales?view=customer"
              linkLabel={t('dashboard.openReport')}
            >
              {charts.topCustomersBySales.length === 0 ? (
                <EmptyChart label={t('dashboard.noData')} />
              ) : (
                <HorizontalBarChart
                  data={customerSalesData(charts.topCustomersBySales)}
                  currency={currency}
                  locale={locale}
                />
              )}
            </ChartPanel>

            <ChartPanel
              title={t('dashboard.chartTopBalances')}
              href="/reports/credit"
              linkLabel={t('dashboard.openReport')}
            >
              {charts.topCustomersByBalance.length === 0 ? (
                <EmptyChart label={t('dashboard.noData')} />
              ) : (
                <HorizontalBarChart
                  data={customerBalanceData(charts.topCustomersByBalance)}
                  currency={currency}
                  locale={locale}
                />
              )}
            </ChartPanel>
          </div>

          <ChartPanel
            title={t('dashboard.chartAgeing')}
            href="/reports/credit"
            linkLabel={t('dashboard.openReport')}
          >
            <AgeingChart
              data={ageingData(charts.creditAgeing)}
              currency={currency}
              locale={locale}
              labels={[
                t('reports.ageing0to30'),
                t('reports.ageing31to60'),
                t('reports.ageingOver60'),
              ]}
            />
          </ChartPanel>
        </>
      ) : null}

      {permissions.sales && charts !== undefined ? (
        <>
          <ChartPanel
            title={t('dashboard.chartWeekday')}
            href="/reports/sales"
            linkLabel={t('dashboard.openReport')}
          >
            <WeekdayChart
              data={weekdayData(charts.salesByWeekday)}
              currency={currency}
              locale={locale}
            />
          </ChartPanel>

          <ChartPanel
            title={t('dashboard.chartPurchasesVsSales')}
            href="/reports/purchases"
            linkLabel={t('dashboard.openReport')}
          >
            {charts.purchasesVersusSales.length === 0 ? (
              <EmptyChart label={t('dashboard.noData')} />
            ) : (
              <PurchasesVersusSalesChart
                data={purchasesVersusSalesData(charts.purchasesVersusSales)}
                currency={currency}
                locale={locale}
                purchasesLabel={t('dashboard.purchases')}
                salesLabel={t('dashboard.sales')}
              />
            )}
          </ChartPanel>
        </>
      ) : null}

      {permissions.inventory && charts !== undefined ? (
        <ChartPanel
          title={t('dashboard.chartSlowMoving')}
          href="/reports/inventory"
          linkLabel={t('dashboard.openReport')}
        >
          {charts.slowMovingStock.length === 0 ? (
            <EmptyChart label={t('dashboard.noSlowMoving')} />
          ) : (
            <div className="table-wrap">
              <table className="data-table report-table">
                <caption className="visually-hidden">{t('dashboard.chartSlowMoving')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('reports.tableProduct')}</th>
                    <th scope="col" className="report-table__number">
                      {t('reports.tableStock')}
                    </th>
                    <th scope="col" className="report-table__number">
                      {t('dashboard.soldQuantity')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slowMovingData(charts.slowMovingStock).map((row) => (
                    <tr key={row.key}>
                      <td>
                        <div className="table-primary">
                          <strong>{row.name}</strong>
                          <small>{row.sku}</small>
                        </div>
                      </td>
                      <td className="report-table__number">{row.currentStock}</td>
                      <td className="report-table__number">{row.soldQuantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartPanel>
      ) : null}

      {kpis.length === 0 ? <p className="muted">{t('dashboard.noData')}</p> : null}

      <p className="muted dashboard-footnote">{t('dashboard.timezoneNote')}</p>
    </div>
  );
}

function buildKpis(
  data: Dashboard,
  permissions: { sales: boolean; full: boolean; inventory: boolean },
  currency: string,
  locale: ReturnType<typeof useI18n>['locale'],
): KpiCard[] {
  const cards: KpiCard[] = [];
  const money = (amount: string) =>
    currency === '' ? amount : formatMoney(amount, currency, locale);

  if (permissions.sales) {
    cards.push(
      {
        key: 'todaySales',
        labelKey: 'dashboard.todaySales',
        value: money(data.kpis.todaySales),
        href: '/reports/sales',
      },
      {
        key: 'monthSales',
        labelKey: 'dashboard.monthSales',
        value: money(data.kpis.monthSales),
        href: '/reports/sales',
      },
      {
        key: 'monthInvoiceCount',
        labelKey: 'dashboard.monthInvoiceCount',
        value: String(data.kpis.monthInvoiceCount),
        href: '/reports/sales',
      },
    );
  }

  if (permissions.full) {
    cards.push(
      {
        key: 'totalOutstandingCredit',
        labelKey: 'dashboard.outstandingCredit',
        value: money(data.kpis.totalOutstandingCredit),
        href: '/reports/credit',
      },
      {
        key: 'overdueAmount',
        labelKey: 'dashboard.overdueAmount',
        value: money(data.kpis.overdueAmount),
        href: '/reports/credit',
      },
      {
        key: 'monthGrossProfit',
        labelKey: 'dashboard.grossProfit',
        value: money(data.kpis.monthGrossProfit),
        href: '/reports/profit',
      },
      {
        key: 'monthMarginPercent',
        labelKey: 'dashboard.margin',
        value: data.kpis.monthMarginPercent === null ? '—' : `${data.kpis.monthMarginPercent}%`,
        href: '/reports/profit',
      },
    );
  }

  if (permissions.inventory) {
    cards.push(
      {
        key: 'lowStockCount',
        labelKey: 'dashboard.lowStockCount',
        value: String(data.kpis.lowStockCount),
        href: '/reports/inventory',
      },
      {
        key: 'nearExpiryCount',
        labelKey: 'dashboard.nearExpiryCount',
        value: String(data.kpis.nearExpiryCount),
        href: '/reports/inventory',
      },
    );
  }

  return cards;
}
