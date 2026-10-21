import {
  buildAgeing,
  daysPastDue,
  escapeCsvValue,
  localDayRange,
  marginPercent,
  toCsv,
  weekdayName,
} from '../src/modules/reports/report-calculations.js';

const TODAY = new Date('2026-10-21T00:00:00.000Z');

describe('report calculations', () => {
  it('counts the days an invoice is past its due date', () => {
    expect(daysPastDue(new Date('2026-10-11T00:00:00.000Z'), TODAY)).toBe(10);
    expect(daysPastDue(new Date('2026-09-21T00:00:00.000Z'), TODAY)).toBe(30);
    expect(daysPastDue(new Date('2026-11-21T00:00:00.000Z'), TODAY)).toBe(0);
    expect(daysPastDue(null, TODAY)).toBe(0);
  });

  it('groups the outstanding invoices into the ageing buckets', () => {
    const result = buildAgeing(
      [
        { dueDate: new Date('2026-10-11T00:00:00.000Z'), outstanding: '100.00' },
        { dueDate: new Date('2026-09-01T00:00:00.000Z'), outstanding: '50.50' },
        { dueDate: new Date('2026-07-21T00:00:00.000Z'), outstanding: '25.00' },
        { dueDate: new Date('2026-11-01T00:00:00.000Z'), outstanding: '10.00' },
      ],
      TODAY,
    );

    expect(result.buckets['0-30']).toBe('100.00');
    expect(result.buckets['31-60']).toBe('50.50');
    expect(result.buckets.OVER_60).toBe('25.00');
    expect(result.overdueTotal).toBe('175.50');
    expect(result.overdueCount).toBe(3);
  });

  it('calculates the gross margin', () => {
    expect(marginPercent('200.00', '80.00')).toBe('40.00');
    expect(marginPercent('200.00', '0.00')).toBe('0.00');
    expect(marginPercent('0.00', '0.00')).toBeNull();
  });

  it('uses the time of Phnom Penh for the range of a report', () => {
    const { start, end } = localDayRange('2026-10-01', '2026-10-31');

    expect(start.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-31T17:00:00.000Z');
  });

  it('names the weekdays from Monday to Sunday', () => {
    expect(weekdayName(1)).toBe('Monday');
    expect(weekdayName(7)).toBe('Sunday');
  });

  it('escapes the values of a CSV file', () => {
    expect(escapeCsvValue('plain')).toBe('plain');
    expect(escapeCsvValue('a,b')).toBe('"a,b"');
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvValue(null)).toBe('');
    expect(escapeCsvValue(12)).toBe('12');
  });

  it('builds a CSV file with a header row', () => {
    const csv = toCsv(
      [
        { key: 'name', header: 'Customer' },
        { key: 'total', header: 'Total' },
      ],
      [{ name: 'Sokha, Restaurant', total: '10.00' }],
    );

    expect(csv).toBe('Customer,Total\r\n"Sokha, Restaurant",10.00');
  });
});
