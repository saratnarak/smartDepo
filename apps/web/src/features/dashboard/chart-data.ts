import type {
  CategoryChartPoint,
  CustomerChartPoint,
  ProductChartPoint,
  PurchasesVersusSalesPoint,
  ReportAgeingBuckets,
  SalesTrendPoint,
  SlowMovingPoint,
  WeekdayChartPoint,
} from '@/lib/types';

/**
 * The data of the charts. The API sends the amounts as decimal strings; the chart needs a number
 * for the geometry, but the label and the tooltip keep the exact string of the API, so the number
 * that is shown is never a rounded float.
 */

export interface ChartDatum {
  /** A stable key for the chart. */
  key: string;
  /** The label of the axis. */
  label: string;
  /** The number that the chart draws. */
  value: number;
  /** The exact amount of the API, for the tooltip. */
  display: string;
}

/** The colours of the series. They are dark enough to be read on a light surface. */
export const CHART_COLORS = [
  '#0f766e',
  '#b45309',
  '#175cd3',
  '#b42318',
  '#6941c6',
  '#0e7490',
  '#a16207',
  '#9e77ed',
  '#c11574',
  '#3f6212',
] as const;

export const AGEING_KEYS = ['0-30', '31-60', 'OVER_60'] as const;

/** The number of a decimal string for the geometry of a chart. */
export function toChartNumber(value: string): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function salesTrendData(points: readonly SalesTrendPoint[]): ChartDatum[] {
  return points.map((point) => ({
    key: point.period,
    label: point.period,
    value: toChartNumber(point.total),
    display: point.total,
  }));
}

export function productRevenueData(points: readonly ProductChartPoint[]): ChartDatum[] {
  return points.map((point) => ({
    key: point.productId,
    label: point.name,
    value: toChartNumber(point.revenue),
    display: point.revenue,
  }));
}

export function productQuantityData(points: readonly ProductChartPoint[]): ChartDatum[] {
  return points.map((point) => ({
    key: point.productId,
    label: point.name,
    value: toChartNumber(point.quantityBase),
    display: point.quantityBase,
  }));
}

export function categoryData(points: readonly CategoryChartPoint[]): ChartDatum[] {
  return points.map((point) => ({
    key: point.categoryId ?? 'uncategorised',
    label: point.name,
    value: toChartNumber(point.total),
    display: point.total,
  }));
}

export function customerSalesData(points: readonly CustomerChartPoint[]): ChartDatum[] {
  return points.map((point) => ({
    key: point.customerId,
    label: point.name,
    value: toChartNumber(point.total),
    display: point.total,
  }));
}

export function customerBalanceData(points: readonly CustomerChartPoint[]): ChartDatum[] {
  return points.map((point) => ({
    key: point.customerId,
    label: point.name,
    value: toChartNumber(point.balance),
    display: point.balance,
  }));
}

/** The three ageing buckets of the credit report. */
export function ageingData(buckets: ReportAgeingBuckets): ChartDatum[] {
  return AGEING_KEYS.map((key) => ({
    key,
    label: key,
    value: toChartNumber(buckets[key]),
    display: buckets[key],
  }));
}

const WEEKDAY_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/**
 * The sales of every day of the week. The API only sends the days that had sales, so the missing
 * days are added with zero to keep the order of the week.
 */
export function weekdayData(points: readonly WeekdayChartPoint[]): ChartDatum[] {
  const byName = new Map(points.map((point) => [point.name, point]));

  return WEEKDAY_ORDER.map((name) => {
    const point = byName.get(name);

    return {
      key: name,
      label: name,
      value: point === undefined ? 0 : toChartNumber(point.total),
      display: point?.total ?? '0.00',
    };
  });
}

export interface PurchasesVersusSalesDatum {
  period: string;
  purchases: number;
  sales: number;
  purchasesDisplay: string;
  salesDisplay: string;
}

export function purchasesVersusSalesData(
  points: readonly PurchasesVersusSalesPoint[],
): PurchasesVersusSalesDatum[] {
  return points.map((point) => ({
    period: point.period,
    purchases: toChartNumber(point.purchases),
    sales: toChartNumber(point.sales),
    purchasesDisplay: point.purchases,
    salesDisplay: point.sales,
  }));
}

export interface SlowMovingRow {
  key: string;
  name: string;
  sku: string;
  currentStock: string;
  soldQuantity: string;
}

export function slowMovingData(points: readonly SlowMovingPoint[]): SlowMovingRow[] {
  return points.map((point) => ({
    key: point.productId,
    name: point.name,
    sku: point.sku,
    currentStock: point.currentStock,
    soldQuantity: point.soldQuantity,
  }));
}
