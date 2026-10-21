'use client';

import { useEffect, useState } from 'react';

import { useI18n } from '@/components/i18n-provider';
import {
  depotToday,
  isValidRange,
  rangeForPreset,
  RANGE_PRESETS,
  type DateRange,
  type RangePreset,
} from '@/lib/depot-dates';

const PRESET_LABELS: Record<RangePreset, string> = {
  today: 'reports.range.today',
  last7: 'reports.range.last7',
  thisMonth: 'reports.range.thisMonth',
  custom: 'reports.range.custom',
};

/**
 * The picker of the period of a report. The days are the days of the depot, the same days the API
 * groups by, so the label of a row and the range of the report always agree.
 */
export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const { t } = useI18n();
  const [preset, setPreset] = useState<RangePreset>('thisMonth');
  const [today, setToday] = useState(() => depotToday());

  useEffect(() => {
    setToday(depotToday());
  }, []);

  const choosePreset = (next: RangePreset) => {
    setPreset(next);
    onChange(rangeForPreset(next, today, value));
  };

  const changeDay = (edge: 'from' | 'to', day: string) => {
    const next: DateRange = { ...value, [edge]: day };

    setPreset('custom');
    onChange(next);
  };

  const invalid = !isValidRange(value);

  return (
    <div className="range-picker">
      <div className="filter-tabs" role="group" aria-label={t('reports.range.label')}>
        {RANGE_PRESETS.map((option) => (
          <button
            key={option}
            type="button"
            className={`filter-tab${preset === option ? ' filter-tab--active' : ''}`}
            aria-pressed={preset === option}
            onClick={() => choosePreset(option)}
          >
            {t(PRESET_LABELS[option])}
          </button>
        ))}
      </div>

      <div className="range-picker__days">
        <label className="range-picker__day">
          <span>{t('reports.range.from')}</span>
          <input
            type="date"
            value={value.from}
            max={value.to}
            onChange={(event) => changeDay('from', event.target.value)}
          />
        </label>
        <label className="range-picker__day">
          <span>{t('reports.range.to')}</span>
          <input
            type="date"
            value={value.to}
            min={value.from}
            onChange={(event) => changeDay('to', event.target.value)}
          />
        </label>
      </div>

      {invalid ? (
        <p className="field__error" role="alert">
          {t('reports.range.invalid')}
        </p>
      ) : null}
    </div>
  );
}
