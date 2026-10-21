'use client';

import { useMemo, useState } from 'react';

import { useI18n } from '@/components/i18n-provider';
import { compareDecimal } from '@/lib/decimal';

export type SortType = 'text' | 'decimal' | 'number';

export interface ReportColumn<T> {
  key: string;
  /** The i18n key of the header of the column. */
  headerKey: string;
  align?: 'left' | 'right';
  /** How the values of the column are compared. */
  sortType?: SortType;
  /** The value that the sorting uses. Without it the column cannot be sorted. */
  sortValue?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
}

export type SortDirection = 'asc' | 'desc';

function compareValues(left: string | number, right: string | number, sortType: SortType): number {
  if (sortType === 'number') {
    const a = typeof left === 'number' ? left : Number(left);
    const b = typeof right === 'number' ? right : Number(right);

    if (Number.isNaN(a) || Number.isNaN(b)) {
      return 0;
    }

    return a === b ? 0 : a < b ? -1 : 1;
  }

  if (sortType === 'decimal') {
    const compared = compareDecimal(String(left), String(right));

    if (compared !== null) {
      return compared;
    }
  }

  return String(left).localeCompare(String(right));
}

/**
 * The table of a report. The rows are sorted in the browser, because the reports of the API have
 * no pages. Amounts are compared as decimal strings, so the order never depends on a floating
 * point number.
 */
export function ReportTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  emptyLabel,
}: {
  columns: readonly ReportColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  caption: string;
  emptyLabel: string;
}) {
  const { t } = useI18n();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [direction, setDirection] = useState<SortDirection>('desc');

  const sorted = useMemo(() => {
    const column = columns.find((entry) => entry.key === sortKey);

    if (column?.sortValue === undefined) {
      return rows;
    }

    const factor = direction === 'asc' ? 1 : -1;

    return [...rows].sort((left, right) => {
      const compared = compareValues(
        column.sortValue?.(left) ?? '',
        column.sortValue?.(right) ?? '',
        column.sortType ?? 'text',
      );

      return compared === 0 ? 0 : compared * factor;
    });
  }, [columns, direction, rows, sortKey]);

  const toggleSort = (column: ReportColumn<T>) => {
    if (column.sortValue === undefined) {
      return;
    }

    if (column.key === sortKey) {
      setDirection((value) => (value === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(column.key);
    setDirection('desc');
  };

  return (
    <div className="table-wrap">
      <table className="data-table report-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const sortable = column.sortValue !== undefined;
              const active = column.key === sortKey;

              return (
                <th
                  key={column.key}
                  scope="col"
                  className={column.align === 'right' ? 'report-table__number' : undefined}
                  aria-sort={
                    active ? (direction === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                >
                  {sortable ? (
                    <button
                      type="button"
                      className="report-table__sort"
                      onClick={() => toggleSort(column)}
                    >
                      <span>{t(column.headerKey)}</span>
                      <span aria-hidden="true" className="report-table__sort-mark">
                        {active ? (direction === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  ) : (
                    t(column.headerKey)
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={column.align === 'right' ? 'report-table__number' : undefined}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 ? <p className="muted report-table__empty">{emptyLabel}</p> : null}
    </div>
  );
}
