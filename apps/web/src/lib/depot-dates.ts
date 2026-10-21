/**
 * The days of the depot. The API groups the days in the time of Phnom Penh (UTC+7 all year), so
 * the browser uses the same day boundaries when it picks a range and when it labels a day.
 */

export const DEPOT_UTC_OFFSET_MINUTES = 7 * 60;

export const RANGE_PRESETS = ['today', 'last7', 'thisMonth', 'custom'] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number];

export interface DateRange {
  /** The first day of the range, as YYYY-MM-DD. */
  from: string;
  /** The last day of the range, as YYYY-MM-DD. */
  to: string;
}

const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** The day of the depot right now, as YYYY-MM-DD. */
export function depotToday(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + DEPOT_UTC_OFFSET_MINUTES * 60 * 1000);

  return shifted.toISOString().slice(0, 10);
}

/** Adds days to a day of the depot. The calendar maths happens in UTC, so no time zone shifts it. */
export function addDays(day: string, days: number): string {
  const parts = day.split('-').map((part) => Number.parseInt(part, 10));
  const [year, month, date] = parts;

  if (year === undefined || month === undefined || date === undefined) {
    return day;
  }

  const result = new Date(Date.UTC(year, month - 1, date));

  result.setUTCDate(result.getUTCDate() + days);

  return result.toISOString().slice(0, 10);
}

/** The first day of the month of a day of the depot. */
export function startOfMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

/** The range of a preset. The custom preset keeps the range that the user picked. */
export function rangeForPreset(preset: RangePreset, today: string, current?: DateRange): DateRange {
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'last7':
      return { from: addDays(today, -6), to: today };
    case 'thisMonth':
      return { from: startOfMonth(today), to: today };
    case 'custom':
      return current ?? { from: today, to: today };
  }
}

export function isIsoDay(value: string): boolean {
  if (!ISO_DAY_PATTERN.test(value)) {
    return false;
  }

  const [year, month, date] = value.split('-').map((part) => Number.parseInt(part, 10));

  if (year === undefined || month === undefined || date === undefined) {
    return false;
  }

  const parsed = new Date(Date.UTC(year, month - 1, date));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === date
  );
}

/** True when the range is a real period: the first day is not after the last day. */
export function isValidRange(range: DateRange): boolean {
  if (!isIsoDay(range.from) || !isIsoDay(range.to)) {
    return false;
  }

  return range.from <= range.to;
}
