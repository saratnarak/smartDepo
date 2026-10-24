import { formatDate, formatDateTime } from '@/lib/format';

describe('the format of the dates', () => {
  it('shows the day of the depot', () => {
    // 2026-10-21T18:30:00Z is 2026-10-22 at 01:30 in the time of the depot.
    expect(formatDateTime('2026-10-21T18:30:00.000Z', 'en')).toContain('22');
    expect(formatDateTime('2026-10-21T18:30:00.000Z', 'en')).toMatch(/\d{2}:\d{2}/);
  });

  it('shows the hour and the minute of the depot', () => {
    expect(formatDateTime('2026-10-21T18:30:00.000Z', 'en')).toContain('01:30');
  });

  it('shows a dash for a value that is not a date', () => {
    expect(formatDateTime('not-a-date', 'en')).toBe('—');
    expect(formatDate('not-a-date', 'en')).toBe('—');
  });
});
