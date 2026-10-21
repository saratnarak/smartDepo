import { Prisma } from '../src/generated/prisma/client.js';
import {
  bucketFor,
  buildAgeingBuckets,
  daysOverdue,
} from '../src/modules/credit/credit-calculations.js';

const money = (value: string): Prisma.Decimal => new Prisma.Decimal(value);
const today = new Date('2026-10-21T00:00:00.000Z');

describe('credit ageing', () => {
  it('counts the days an invoice is past its due date', () => {
    expect(daysOverdue(new Date('2026-10-11T00:00:00.000Z'), today)).toBe(10);
    expect(daysOverdue(new Date('2026-09-21T00:00:00.000Z'), today)).toBe(30);
    expect(daysOverdue(new Date('2026-10-21T00:00:00.000Z'), today)).toBe(0);
    expect(daysOverdue(new Date('2026-11-21T00:00:00.000Z'), today)).toBe(0);
    expect(daysOverdue(null, today)).toBe(0);
  });

  it('puts the days into the right bucket', () => {
    expect(bucketFor(0)).toBe('0-30');
    expect(bucketFor(30)).toBe('0-30');
    expect(bucketFor(31)).toBe('31-60');
    expect(bucketFor(60)).toBe('31-60');
    expect(bucketFor(61)).toBe('OVER_60');
  });

  it('adds the outstanding amounts of every invoice into the buckets', () => {
    const buckets = buildAgeingBuckets([
      { daysOverdue: 10, outstanding: money('100.00') },
      { daysOverdue: 20, outstanding: money('50.25') },
      { daysOverdue: 45, outstanding: money('300.00') },
      { daysOverdue: 90, outstanding: money('25.00') },
    ]);

    expect(buckets.map((bucket) => bucket.key)).toEqual(['0-30', '31-60', 'OVER_60']);
    expect(buckets[0].invoiceCount).toBe(2);
    expect(buckets[0].amount).toBe('150.25');
    expect(buckets[1].invoiceCount).toBe(1);
    expect(buckets[1].amount).toBe('300.00');
    expect(buckets[2].invoiceCount).toBe(1);
    expect(buckets[2].amount).toBe('25.00');
  });

  it('returns empty buckets when nothing is open', () => {
    const buckets = buildAgeingBuckets([]);

    expect(buckets.every((bucket) => bucket.invoiceCount === 0)).toBe(true);
    expect(buckets.every((bucket) => bucket.amount === '0.00')).toBe(true);
  });
});
