import { compareMoney, sumMoney, toMoney } from '../../common/money/money.js';
import { Prisma } from '../../generated/prisma/client.js';

/**
 * The calculations behind the reports. They are pure functions so they can be tested without a
 * database, and they only work with decimal strings; no amount is ever a floating point number.
 */

export type SalesPeriodUnit = 'day' | 'week' | 'month' | 'custom';

/** Phnom Penh is UTC+7 all year, so the offset is fixed. */
export const DEPOT_UTC_OFFSET_HOURS = 7;

/**
 * The first and the day after the last day of a range, in the time of the depot. The end is
 * exclusive, so the SQL uses `>= start` and `< end`.
 */
export function localDayRange(
  from: string,
  to: string,
  offsetHours = DEPOT_UTC_OFFSET_HOURS,
): { start: Date; end: Date } {
  const sign = offsetHours >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetHours);
  const zone = `${sign}${String(absolute).padStart(2, '0')}:00`;
  const start = new Date(`${from}T00:00:00${zone}`);
  const lastDay = new Date(`${to}T00:00:00${zone}`);

  return { start, end: new Date(lastDay.getTime() + 24 * 60 * 60 * 1000) };
}

export interface AgeingInvoice {
  dueDate: Date | null;
  outstanding: string;
}

export interface AgeingBuckets {
  '0-30': string;
  '31-60': string;
  OVER_60: string;
}

export interface AgeingResult {
  buckets: AgeingBuckets;
  overdueTotal: string;
  overdueCount: number;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

/** The days an invoice is past its due date. Zero when it is not due yet. */
export function daysPastDue(dueDate: Date | null, today: Date): number {
  if (dueDate === null) {
    return 0;
  }

  const days = Math.round((startOfUtcDay(today) - startOfUtcDay(dueDate)) / DAY_IN_MS);

  return days > 0 ? days : 0;
}

/** Groups the open invoices of the customers into the ageing buckets. */
export function buildAgeing(invoices: readonly AgeingInvoice[], today: Date): AgeingResult {
  const buckets: Record<'0-30' | '31-60' | 'OVER_60', string[]> = {
    '0-30': [],
    '31-60': [],
    OVER_60: [],
  };
  let overdueCount = 0;

  for (const invoice of invoices) {
    const days = daysPastDue(invoice.dueDate, today);

    if (days === 0) {
      continue;
    }

    overdueCount += 1;

    if (days <= 30) {
      buckets['0-30'].push(invoice.outstanding);
    } else if (days <= 60) {
      buckets['31-60'].push(invoice.outstanding);
    } else {
      buckets.OVER_60.push(invoice.outstanding);
    }
  }

  return {
    buckets: {
      '0-30': sumMoney(buckets['0-30']).toFixed(2),
      '31-60': sumMoney(buckets['31-60']).toFixed(2),
      OVER_60: sumMoney(buckets.OVER_60).toFixed(2),
    },
    overdueTotal: sumMoney([...buckets['0-30'], ...buckets['31-60'], ...buckets.OVER_60]).toFixed(
      2,
    ),
    overdueCount,
  };
}

/** The gross margin in percent. Null when there is no revenue. */
export function marginPercent(revenue: string, profit: string): string | null {
  if (compareMoney(revenue, '0') <= 0) {
    return null;
  }

  return toMoney(new Prisma.Decimal(profit).div(revenue).times(100)).toFixed(2);
}

/** The name of a weekday, where 1 is Monday and 7 is Sunday. */
export function weekdayName(weekday: number): string {
  const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return names[weekday - 1] ?? 'Unknown';
}

/** Escapes one value for a CSV file. */
export function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

/** Builds a CSV file with a header row. */
export function toCsv(
  columns: readonly { key: string; header: string }[],
  rows: ReadonlyArray<object>,
): string {
  const header = columns.map((column) => escapeCsvValue(column.header)).join(',');
  const body = rows.map((row) => {
    const record = row as Record<string, string | number | null | undefined>;

    return columns.map((column) => escapeCsvValue(record[column.key])).join(',');
  });

  return [header, ...body].join('\r\n');
}
