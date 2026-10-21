import {
  addDays,
  depotToday,
  isIsoDay,
  isValidRange,
  rangeForPreset,
  startOfMonth,
} from '@/lib/depot-dates';

describe('the days of the depot', () => {
  it('uses the time of Phnom Penh for the day', () => {
    // 2026-10-21 17:30 UTC is already the next day in Phnom Penh (UTC+7).
    expect(depotToday(new Date('2026-10-21T17:30:00.000Z'))).toBe('2026-10-22');
    expect(depotToday(new Date('2026-10-21T16:30:00.000Z'))).toBe('2026-10-21');
  });

  it('adds days without a time zone shift', () => {
    expect(addDays('2026-10-21', 0)).toBe('2026-10-21');
    expect(addDays('2026-10-21', -1)).toBe('2026-10-20');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('finds the first day of the month', () => {
    expect(startOfMonth('2026-10-21')).toBe('2026-10-01');
    expect(startOfMonth('2026-01-09')).toBe('2026-01-01');
  });

  it('builds the range of every preset', () => {
    expect(rangeForPreset('today', '2026-10-21')).toEqual({
      from: '2026-10-21',
      to: '2026-10-21',
    });
    expect(rangeForPreset('last7', '2026-10-21')).toEqual({
      from: '2026-10-15',
      to: '2026-10-21',
    });
    expect(rangeForPreset('thisMonth', '2026-10-21')).toEqual({
      from: '2026-10-01',
      to: '2026-10-21',
    });
    expect(
      rangeForPreset('custom', '2026-10-21', { from: '2026-01-01', to: '2026-01-31' }),
    ).toEqual({ from: '2026-01-01', to: '2026-01-31' });
  });

  it('checks the days and the ranges', () => {
    expect(isIsoDay('2026-10-21')).toBe(true);
    expect(isIsoDay('2026-13-01')).toBe(false);
    expect(isIsoDay('2026-02-30')).toBe(false);
    expect(isIsoDay('21-10-2026')).toBe(false);
    expect(isValidRange({ from: '2026-10-01', to: '2026-10-31' })).toBe(true);
    expect(isValidRange({ from: '2026-10-31', to: '2026-10-01' })).toBe(false);
    expect(isValidRange({ from: 'nonsense', to: '2026-10-01' })).toBe(false);
  });
});
