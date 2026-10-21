import { toMoney } from '../../common/money/money.js';
import { Prisma } from '../../generated/prisma/client.js';

/**
 * Ageing buckets for the credit report (FR-27). The buckets count the days an invoice is past its
 * due date: 0-30 days, 31-60 days, and more than 60 days.
 */
export const AGEING_BUCKET_KEYS = ['0-30', '31-60', 'OVER_60'] as const;

export type AgeingBucketKey = (typeof AGEING_BUCKET_KEYS)[number];

export interface AgeingEntry {
  daysOverdue: number;
  outstanding: Prisma.Decimal;
}

export interface AgeingBucket {
  key: AgeingBucketKey;
  minDays: number;
  maxDays: number | null;
  invoiceCount: number;
  amount: string;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

/** Days between the due date and today. Zero when the invoice is not due yet. */
export function daysOverdue(dueDate: Date | null, today: Date): number {
  if (dueDate === null) {
    return 0;
  }

  const days = Math.round((startOfUtcDay(today) - startOfUtcDay(dueDate)) / DAY_IN_MS);
  return days > 0 ? days : 0;
}

export function bucketFor(days: number): AgeingBucketKey {
  if (days <= 30) {
    return '0-30';
  }

  if (days <= 60) {
    return '31-60';
  }

  return 'OVER_60';
}

/** Groups outstanding amounts into the ageing buckets. */
export function buildAgeingBuckets(entries: readonly AgeingEntry[]): AgeingBucket[] {
  const buckets: Record<AgeingBucketKey, AgeingBucket> = {
    '0-30': { key: '0-30', minDays: 0, maxDays: 30, invoiceCount: 0, amount: '0.00' },
    '31-60': { key: '31-60', minDays: 31, maxDays: 60, invoiceCount: 0, amount: '0.00' },
    OVER_60: { key: 'OVER_60', minDays: 61, maxDays: null, invoiceCount: 0, amount: '0.00' },
  };

  for (const entry of entries) {
    const bucket = buckets[bucketFor(entry.daysOverdue)];
    bucket.invoiceCount += 1;
    bucket.amount = toMoney(new Prisma.Decimal(bucket.amount).plus(entry.outstanding)).toFixed(2);
  }

  return AGEING_BUCKET_KEYS.map((key) => buckets[key]);
}
