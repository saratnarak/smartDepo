'use client';

import { useEffect, useMemo, useState } from 'react';

import { useI18n } from '@/components/i18n-provider';
import {
  getCreditReport,
  getDepotSettings,
  getInventoryReport,
  getProfitReport,
  getPurchasesReport,
  getSalesByCategoryReport,
  getSalesByCustomerReport,
  getSalesByProductReport,
  getSalesByStaffReport,
  getSalesReport,
} from '@/lib/api-client';
import { sumDecimals } from '@/lib/decimal';
import { getErrorMessage } from '@/lib/errors';
import { formatDate, formatMoney } from '@/lib/format';
import { roleHasPermission } from '@/lib/permissions';
import type {
  CreditReport,
  CreditReportRow,
  InventoryReport,
  InventoryReportRow,
  ProfitReport,
  PurchaseReport,
  PurchaseReportRow,
  ReportUnit,
  SalesGroupRow,
  SalesProductRow,
  SalesReport,
  SalesReportRow,
  UserRole,
} from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';
import { DateRangePicker } from './date-range-picker';
import { depotToday, rangeForPreset, type DateRange } from '@/lib/depot-dates';
import {
  CsvDownloadButton,
  LargeResultWarning,
  ReportEmptyState,
  ReportError,
  ReportLoading,
} from './report-parts';
import { ReportTable, type ReportColumn } from './report-table';
import { reportByKey, salesViewsForRole, type SalesView } from './report-registry';

interface SummaryItem {
  labelKey: string;
  value: string;
}

interface ViewProps {
  range: DateRange;
  currency: string;
  locale: ReturnType<typeof useI18n>['locale'];
}

function money(amount: string, currency: string, locale: ViewProps['locale']): string {
  return currency === '' ? amount : formatMoney(amount, currency, locale);
}

/** The sales report of the depot, grouped by day, week, or month. */
function SalesPeriodView({ range, currency, locale, unit }: ViewProps & { unit: ReportUnit }) {
  const { t } = useI18n();
  const [data, setData] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    getSalesReport({ from: range.from, to: range.to, unit })
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
  }, [range.from, range.to, reloadKey, t, unit]);

  const columns: ReportColumn<SalesReportRow>[] = [
    {
      key: 'period',
      headerKey: 'reports.tablePeriod',
      sortType: 'text',
      sortValue: (row) => row.period,
      render: (row) => row.period,
    },
    {
      key: 'invoiceCount',
      headerKey: 'reports.tableInvoices',
      align: 'right',
      sortType: 'number',
      sortValue: (row) => row.invoiceCount,
      render: (row) => row.invoiceCount,
    },
    {
      key: 'total',
      headerKey: 'reports.tableTotal',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.total,
      render: (row) => <span className="money">{money(row.total, currency, locale)}</span>,
    },
    {
      key: 'paid',
      headerKey: 'reports.tablePaid',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.paid ?? '0',
      render: (row) =>
        row.paid === undefined ? (
          <span className="muted">—</span>
        ) : (
          <span className="money">{money(row.paid, currency, locale)}</span>
        ),
    },
    {
      key: 'outstanding',
      headerKey: 'reports.tableOutstanding',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.outstanding ?? '0',
      render: (row) =>
        row.outstanding === undefined ? (
          <span className="muted">—</span>
        ) : (
          <span className="money">{money(row.outstanding, currency, locale)}</span>
        ),
    },
  ];

  const summary: SummaryItem[] =
    data === null
      ? []
      : [
          { labelKey: 'reports.summaryInvoices', value: String(data.totals.invoiceCount) },
          { labelKey: 'reports.summaryTotal', value: money(data.totals.total, currency, locale) },
          { labelKey: 'reports.summaryPaid', value: money(data.totals.paid, currency, locale) },
          {
            labelKey: 'reports.summaryOutstanding',
            value: money(data.totals.outstanding, currency, locale),
          },
        ];

  const params = new URLSearchParams({ from: range.from, to: range.to, unit });

  return (
    <>
      <SummaryCards items={summary} />
      <LargeResultWarning count={data?.rows.length ?? 0} />
      {loading ? (
        <ReportLoading />
      ) : error !== null ? (
        <ReportError message={error} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : (
        <ReportTable
          caption={t('reports.report.sales')}
          emptyLabel={t('reports.empty')}
          columns={columns}
          rows={data?.rows ?? []}
          rowKey={(row) => row.period}
        />
      )}
      <CsvDownloadButton fileName="sales.csv" path="/reports/sales" params={params} />
    </>
  );
}

/** The sales of the depot per product, category, customer, or staff member. */
function SalesBreakdownView({
  view,
  range,
  currency,
  locale,
}: ViewProps & { view: Exclude<SalesView, 'period'> }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<SalesProductRow[] | SalesGroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const loader = (): Promise<SalesProductRow[] | SalesGroupRow[]> => {
      switch (view) {
        case 'product':
          return getSalesByProductReport({ from: range.from, to: range.to });
        case 'category':
          return getSalesByCategoryReport({ from: range.from, to: range.to });
        case 'customer':
          return getSalesByCustomerReport({ from: range.from, to: range.to });
        case 'staff':
          return getSalesByStaffReport({ from: range.from, to: range.to });
      }
    };

    setLoading(true);
    setError(null);

    loader()
      .then((result) => {
        if (active) {
          setRows(result);
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
  }, [range.from, range.to, reloadKey, t, view]);

  const productColumns: ReportColumn<SalesProductRow>[] = [
    {
      key: 'name',
      headerKey: 'reports.tableProduct',
      sortType: 'text',
      sortValue: (row) => row.name,
      render: (row) => (
        <div className="table-primary">
          <strong>{row.name}</strong>
          <small>{row.sku}</small>
        </div>
      ),
    },
    {
      key: 'quantityBase',
      headerKey: 'reports.tableQuantity',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.quantityBase,
      render: (row) => row.quantityBase,
    },
    {
      key: 'revenue',
      headerKey: 'reports.tableRevenue',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.revenue,
      render: (row) => <span className="money">{money(row.revenue, currency, locale)}</span>,
    },
    {
      key: 'profit',
      headerKey: 'reports.tableProfit',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.profit,
      render: (row) => <span className="money">{money(row.profit, currency, locale)}</span>,
    },
    {
      key: 'margin',
      headerKey: 'reports.tableMargin',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.marginPercent ?? '0',
      render: (row) =>
        row.marginPercent === null ? <span className="muted">—</span> : `${row.marginPercent}%`,
    },
  ];

  const groupColumns: ReportColumn<SalesGroupRow>[] = [
    {
      key: 'name',
      headerKey:
        view === 'category'
          ? 'reports.tableCategory'
          : view === 'customer'
            ? 'reports.tableCustomer'
            : 'reports.tableStaff',
      sortType: 'text',
      sortValue: (row) => row.name,
      render: (row) => (
        <div className="table-primary">
          <strong>{row.name}</strong>
          {row.detail === null ? null : <small>{row.detail}</small>}
        </div>
      ),
    },
    {
      key: 'invoiceCount',
      headerKey: 'reports.tableInvoices',
      align: 'right',
      sortType: 'number',
      sortValue: (row) => row.invoiceCount,
      render: (row) => row.invoiceCount,
    },
    {
      key: 'total',
      headerKey: 'reports.tableTotal',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.total,
      render: (row) => <span className="money">{money(row.total, currency, locale)}</span>,
    },
    {
      key: 'paid',
      headerKey: 'reports.tablePaid',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.paid,
      render: (row) => <span className="money">{money(row.paid, currency, locale)}</span>,
    },
    {
      key: 'outstanding',
      headerKey: 'reports.tableOutstanding',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.outstanding,
      render: (row) => <span className="money">{money(row.outstanding, currency, locale)}</span>,
    },
  ];

  const isProduct = view === 'product';
  const summary: SummaryItem[] = useMemo(() => {
    const total = sumDecimals(rows.map((row) => ('revenue' in row ? row.revenue : row.total)));

    return [
      { labelKey: 'reports.summaryRows', value: String(rows.length) },
      {
        labelKey: 'reports.summaryTotal',
        value: money(total ?? '0', currency, locale),
      },
    ];
  }, [currency, locale, rows]);

  const apiPath = `/reports/sales/by-${view}`;
  const params = new URLSearchParams({ from: range.from, to: range.to });

  return (
    <>
      <SummaryCards items={summary} />
      <LargeResultWarning count={rows.length} />
      {loading ? (
        <ReportLoading />
      ) : error !== null ? (
        <ReportError message={error} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : isProduct ? (
        <ReportTable
          caption={t('reports.report.salesByProduct')}
          emptyLabel={t('reports.empty')}
          columns={productColumns}
          rows={rows as SalesProductRow[]}
          rowKey={(row) => row.productId}
        />
      ) : (
        <ReportTable
          caption={t('reports.report.salesByCategory')}
          emptyLabel={t('reports.empty')}
          columns={groupColumns}
          rows={rows as SalesGroupRow[]}
          rowKey={(row) => row.groupId}
        />
      )}
      <CsvDownloadButton fileName={`sales-by-${view}.csv`} path={apiPath} params={params} />
    </>
  );
}

/** The inventory of the depot. */
function InventoryView({ currency, locale }: Omit<ViewProps, 'range'>) {
  const { t } = useI18n();
  const [data, setData] = useState<InventoryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    getInventoryReport()
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

  const columns: ReportColumn<InventoryReportRow>[] = [
    {
      key: 'name',
      headerKey: 'reports.tableProduct',
      sortType: 'text',
      sortValue: (row) => row.name,
      render: (row) => (
        <div className="table-primary">
          <strong>{row.name}</strong>
          <small>{row.sku}</small>
        </div>
      ),
    },
    {
      key: 'currentStock',
      headerKey: 'reports.tableStock',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.currentStock,
      render: (row) => row.currentStockReadable,
    },
    {
      key: 'reorderLevel',
      headerKey: 'reports.tableReorderLevel',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.reorderLevel,
      render: (row) => row.reorderLevel,
    },
    {
      key: 'lowStock',
      headerKey: 'reports.tableLowStock',
      align: 'right',
      sortType: 'text',
      sortValue: (row) => (row.lowStock ? '1' : '0'),
      render: (row) =>
        row.lowStock ? (
          <span className="status-badge status-badge--warning">{t('reports.lowStock')}</span>
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      key: 'batches',
      headerKey: 'reports.tableBatches',
      sortType: 'number',
      sortValue: (row) => row.batches.length,
      render: (row) =>
        row.batches.length === 0 ? (
          <span className="muted">—</span>
        ) : (
          <ul className="report-batches">
            {row.batches.map((batch) => (
              <li key={batch.batchId}>
                <span>{batch.batchNumber}</span>
                <small>
                  {batch.expiryDate === null
                    ? '—'
                    : `${formatDate(batch.expiryDate, locale)} · ${batch.stock}`}
                </small>
              </li>
            ))}
          </ul>
        ),
    },
    {
      key: 'stockValue',
      headerKey: 'reports.tableStockValue',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.stockValue,
      render: (row) => <span className="money">{money(row.stockValue, currency, locale)}</span>,
    },
  ];

  const summary: SummaryItem[] =
    data === null
      ? []
      : [
          { labelKey: 'reports.summaryProducts', value: String(data.productCount) },
          { labelKey: 'reports.summaryLowStock', value: String(data.lowStockCount) },
          { labelKey: 'reports.summaryNearExpiry', value: String(data.nearExpiryBatchCount) },
          {
            labelKey: 'reports.summaryStockValue',
            value: money(data.totalStockValue, currency, locale),
          },
        ];

  return (
    <>
      <SummaryCards items={summary} />
      <LargeResultWarning count={data?.rows.length ?? 0} />
      {loading ? (
        <ReportLoading />
      ) : error !== null ? (
        <ReportError message={error} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : (
        <ReportTable
          caption={t('reports.report.inventory')}
          emptyLabel={t('reports.empty')}
          columns={columns}
          rows={data?.rows ?? []}
          rowKey={(row) => row.productId}
        />
      )}
      <CsvDownloadButton
        fileName="inventory.csv"
        path="/reports/inventory"
        params={new URLSearchParams({ expiryDays: '30' })}
      />
    </>
  );
}

/** The credit of the depot with the ageing buckets. */
function CreditView({ currency, locale }: Omit<ViewProps, 'range'>) {
  const { t } = useI18n();
  const [data, setData] = useState<CreditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    getCreditReport()
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

  const columns: ReportColumn<CreditReportRow>[] = [
    {
      key: 'name',
      headerKey: 'reports.tableCustomer',
      sortType: 'text',
      sortValue: (row) => row.name,
      render: (row) => (
        <div className="table-primary">
          <strong>{row.name}</strong>
          <small>{row.type}</small>
        </div>
      ),
    },
    {
      key: 'invoiced',
      headerKey: 'reports.tableInvoiced',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.invoiced,
      render: (row) => <span className="money">{money(row.invoiced, currency, locale)}</span>,
    },
    {
      key: 'paid',
      headerKey: 'reports.tablePaid',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.paid,
      render: (row) => <span className="money">{money(row.paid, currency, locale)}</span>,
    },
    {
      key: 'outstanding',
      headerKey: 'reports.tableOutstanding',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.outstanding,
      render: (row) => <span className="money">{money(row.outstanding, currency, locale)}</span>,
    },
    {
      key: 'overdue',
      headerKey: 'reports.tableOverdue',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.overdue,
      render: (row) => <span className="money">{money(row.overdue, currency, locale)}</span>,
    },
    {
      key: 'ageing',
      headerKey: 'reports.tableAgeing',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.ageing['0-30'],
      render: (row) => (
        <div className="report-ageing">
          <span>
            {t('reports.ageing0to30')}: {money(row.ageing['0-30'], currency, locale)}
          </span>
          <span>
            {t('reports.ageing31to60')}: {money(row.ageing['31-60'], currency, locale)}
          </span>
          <span>
            {t('reports.ageingOver60')}: {money(row.ageing.OVER_60, currency, locale)}
          </span>
        </div>
      ),
    },
  ];

  const summary: SummaryItem[] =
    data === null
      ? []
      : [
          {
            labelKey: 'reports.summaryOutstanding',
            value: money(data.totalOutstanding, currency, locale),
          },
          { labelKey: 'reports.summaryOverdue', value: money(data.totalOverdue, currency, locale) },
          { labelKey: 'reports.summaryRows', value: String(data.rows.length) },
        ];

  return (
    <>
      <SummaryCards items={summary} />
      <LargeResultWarning count={data?.rows.length ?? 0} />
      {loading ? (
        <ReportLoading />
      ) : error !== null ? (
        <ReportError message={error} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : (
        <ReportTable
          caption={t('reports.report.credit')}
          emptyLabel={t('reports.empty')}
          columns={columns}
          rows={data?.rows ?? []}
          rowKey={(row) => row.customerId}
        />
      )}
      <CsvDownloadButton
        fileName="credit.csv"
        path="/reports/credit"
        params={new URLSearchParams()}
      />
    </>
  );
}

/** The profit of the depot. */
function ProfitView({ range, currency, locale }: ViewProps) {
  const { t } = useI18n();
  const [data, setData] = useState<ProfitReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    getProfitReport({ from: range.from, to: range.to })
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
  }, [range.from, range.to, reloadKey, t]);

  const columns: ReportColumn<SalesProductRow>[] = [
    {
      key: 'name',
      headerKey: 'reports.tableProduct',
      sortType: 'text',
      sortValue: (row) => row.name,
      render: (row) => (
        <div className="table-primary">
          <strong>{row.name}</strong>
          <small>{row.sku}</small>
        </div>
      ),
    },
    {
      key: 'quantityBase',
      headerKey: 'reports.tableQuantity',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.quantityBase,
      render: (row) => row.quantityBase,
    },
    {
      key: 'revenue',
      headerKey: 'reports.tableRevenue',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.revenue,
      render: (row) => <span className="money">{money(row.revenue, currency, locale)}</span>,
    },
    {
      key: 'cost',
      headerKey: 'reports.tableCost',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.cost,
      render: (row) => <span className="money">{money(row.cost, currency, locale)}</span>,
    },
    {
      key: 'profit',
      headerKey: 'reports.tableProfit',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.profit,
      render: (row) => <span className="money">{money(row.profit, currency, locale)}</span>,
    },
    {
      key: 'margin',
      headerKey: 'reports.tableMargin',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.marginPercent ?? '0',
      render: (row) =>
        row.marginPercent === null ? <span className="muted">—</span> : `${row.marginPercent}%`,
    },
  ];

  const summary: SummaryItem[] =
    data === null
      ? []
      : [
          { labelKey: 'reports.summaryRevenue', value: money(data.revenue, currency, locale) },
          { labelKey: 'reports.summaryCost', value: money(data.cost, currency, locale) },
          { labelKey: 'reports.summaryProfit', value: money(data.profit, currency, locale) },
          {
            labelKey: 'reports.summaryMargin',
            value: data.marginPercent === null ? '—' : `${data.marginPercent}%`,
          },
        ];

  const params = new URLSearchParams({ from: range.from, to: range.to });

  return (
    <>
      <SummaryCards items={summary} />
      <LargeResultWarning count={data?.rows.length ?? 0} />
      {loading ? (
        <ReportLoading />
      ) : error !== null ? (
        <ReportError message={error} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : (
        <ReportTable
          caption={t('reports.report.profit')}
          emptyLabel={t('reports.empty')}
          columns={columns}
          rows={data?.rows ?? []}
          rowKey={(row) => row.productId}
        />
      )}
      <CsvDownloadButton fileName="profit.csv" path="/reports/profit" params={params} />
    </>
  );
}

/** The purchases of the depot. */
function PurchasesView({ range, currency, locale }: ViewProps) {
  const { t } = useI18n();
  const [data, setData] = useState<PurchaseReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    getPurchasesReport({ from: range.from, to: range.to })
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
  }, [range.from, range.to, reloadKey, t]);

  const columns: ReportColumn<PurchaseReportRow>[] = [
    {
      key: 'name',
      headerKey: 'reports.tableSupplier',
      sortType: 'text',
      sortValue: (row) => row.name,
      render: (row) => row.name,
    },
    {
      key: 'period',
      headerKey: 'reports.tablePeriod',
      sortType: 'text',
      sortValue: (row) => row.period,
      render: (row) => row.period,
    },
    {
      key: 'purchaseCount',
      headerKey: 'reports.tablePurchases',
      align: 'right',
      sortType: 'number',
      sortValue: (row) => row.purchaseCount,
      render: (row) => row.purchaseCount,
    },
    {
      key: 'total',
      headerKey: 'reports.tableTotal',
      align: 'right',
      sortType: 'decimal',
      sortValue: (row) => row.total,
      render: (row) => <span className="money">{money(row.total, currency, locale)}</span>,
    },
  ];

  const summary: SummaryItem[] =
    data === null
      ? []
      : [
          {
            labelKey: 'reports.summaryPurchases',
            value: money(data.totalPurchases, currency, locale),
          },
          { labelKey: 'reports.summaryRows', value: String(data.rows.length) },
        ];

  const params = new URLSearchParams({ from: range.from, to: range.to });

  return (
    <>
      <SummaryCards items={summary} />
      <LargeResultWarning count={data?.rows.length ?? 0} />
      {loading ? (
        <ReportLoading />
      ) : error !== null ? (
        <ReportError message={error} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : (
        <ReportTable
          caption={t('reports.report.purchases')}
          emptyLabel={t('reports.empty')}
          columns={columns}
          rows={data?.rows ?? []}
          rowKey={(row) => `${row.supplierId}-${row.period}`}
        />
      )}
      <CsvDownloadButton fileName="purchases.csv" path="/reports/purchases" params={params} />
    </>
  );
}

function SummaryCards({ items }: { items: readonly SummaryItem[] }) {
  const { t } = useI18n();

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="summary-grid" aria-label={t('reports.summary')}>
      {items.map((item) => (
        <article className="summary-card" key={item.labelKey}>
          <span className="summary-card__label">{t(item.labelKey)}</span>
          <strong className="money">{item.value}</strong>
        </article>
      ))}
    </section>
  );
}

/**
 * The page of a report. The role decides which report is shown: the sales staff get the sales
 * report, the stock keeper the inventory and the purchase reports, and the owner every report.
 * The API stays the real guard.
 */
export function ReportsManager({
  reportKey,
  salesView = 'period',
}: {
  reportKey: string;
  salesView?: SalesView;
}) {
  const { t, locale } = useI18n();
  const role = useSessionStore((state) => state.role) ?? ('OWNER' as UserRole);
  const [currency, setCurrency] = useState('');
  const [range, setRange] = useState<DateRange>(() => rangeForPreset('thisMonth', depotToday()));
  const [unit, setUnit] = useState<ReportUnit>('day');

  useEffect(() => {
    let active = true;

    getDepotSettings()
      .then((settings) => {
        if (active) {
          setCurrency(settings.currency);
        }
      })
      .catch(() => {
        if (active) {
          setCurrency('');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const definition = reportByKey(reportKey);
  const allowed = definition !== undefined && roleHasPermission(role, definition.permission);
  const views = salesViewsForRole(role);
  const isSales = definition !== undefined && definition.key.startsWith('sales');

  if (definition === undefined) {
    return (
      <div className="page-stack">
        <ReportEmptyState title={t('reports.notFoundTitle')} body={t('reports.notFoundBody')} />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="page-stack">
        <ReportEmptyState title={t('forbidden.title')} body={t('forbidden.message')} />
      </div>
    );
  }

  const usesRange = !['inventory', 'credit'].includes(definition.key);

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t('reports.eyebrow')}</p>
          <h2>{t(definition.labelKey)}</h2>
          <p className="muted">{t(definition.descriptionKey)}</p>
        </div>
      </section>

      {isSales ? (
        <div className="filter-tabs" role="group" aria-label={t('reports.salesViews')}>
          {views.map((view) => (
            <a
              key={view}
              href={view === 'period' ? '/reports/sales' : `/reports/sales?view=${view}`}
              className={`filter-tab${view === salesView ? ' filter-tab--active' : ''}`}
              aria-current={view === salesView ? 'page' : undefined}
            >
              {t(`reports.view.${view}`)}
            </a>
          ))}
        </div>
      ) : null}

      {usesRange ? (
        <section className="panel">
          <div className="toolbar toolbar--wrap">
            <h3 className="toolbar__title">{t('reports.range.label')}</h3>
            {definition.key === 'sales' ? (
              <div className="filter-tabs" role="group" aria-label={t('reports.unit')}>
                {(['day', 'week', 'month'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`filter-tab${unit === option ? ' filter-tab--active' : ''}`}
                    aria-pressed={unit === option}
                    onClick={() => setUnit(option)}
                  >
                    {t(`reports.unit.${option}`)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <DateRangePicker value={range} onChange={setRange} />
        </section>
      ) : null}

      <section className="panel panel--flush">
        <div className="panel__body report-body">
          {definition.key === 'sales' ? (
            <SalesPeriodView range={range} currency={currency} locale={locale} unit={unit} />
          ) : null}
          {isSales && salesView !== 'period' ? (
            <SalesBreakdownView
              view={salesView}
              range={range}
              currency={currency}
              locale={locale}
            />
          ) : null}
          {definition.key === 'inventory' ? (
            <InventoryView currency={currency} locale={locale} />
          ) : null}
          {definition.key === 'credit' ? <CreditView currency={currency} locale={locale} /> : null}
          {definition.key === 'profit' ? (
            <ProfitView range={range} currency={currency} locale={locale} />
          ) : null}
          {definition.key === 'purchases' ? (
            <PurchasesView range={range} currency={currency} locale={locale} />
          ) : null}
        </div>
      </section>
    </div>
  );
}
