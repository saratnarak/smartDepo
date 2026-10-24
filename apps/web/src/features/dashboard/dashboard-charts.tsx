'use client';

import Link from 'next/link';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyMark } from '@/components/empty-mark';
import { useI18n } from '@/components/i18n-provider';
import { formatMoney } from '@/lib/format';
import { CHART_COLORS, type ChartDatum, type PurchasesVersusSalesDatum } from './chart-data';

type ChartFormat = 'money' | 'number';

interface TooltipEntry {
  value?: number | string;
  payload?: { display?: string };
}

function ChartTooltip({
  active,
  payload,
  format,
  currency,
  locale,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  format: ChartFormat;
  currency: string;
  locale: ReturnType<typeof useI18n>['locale'];
}) {
  if (active !== true || payload === undefined || payload.length === 0) {
    return null;
  }

  const entry = payload[0];

  if (entry === undefined) {
    return null;
  }

  const display = entry.payload?.display;

  if (display === undefined) {
    return null;
  }

  const text =
    format === 'money' && currency !== '' ? formatMoney(display, currency, locale) : display;

  return (
    <div className="chart-tooltip">
      <span>{text}</span>
    </div>
  );
}

/** The panel of a chart with the link to the report of the same numbers. */
export function ChartPanel({
  title,
  description,
  href,
  linkLabel,
  children,
}: {
  title: string;
  description?: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel chart-panel">
      <div className="panel__heading">
        <h3>{title}</h3>
        <Link href={href} className="chart-panel__link">
          {linkLabel}
        </Link>
      </div>
      {description === undefined ? null : <p className="muted chart-panel__note">{description}</p>}
      {children}
    </section>
  );
}

export function EmptyChart({ label }: { label: string }) {
  return (
    <div className="empty-state chart-panel__empty">
      <EmptyMark variant="chart" />
      <div>
        <p>{label}</p>
      </div>
    </div>
  );
}

/** The sales over time. */
export function SalesTrendChart({
  data,
  currency,
  locale,
}: {
  data: readonly ChartDatum[];
  currency: string;
  locale: ReturnType<typeof useI18n>['locale'];
}) {
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data as ChartDatum[]} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11 }} width={64} />
          <Tooltip
            cursor={{ fill: 'var(--surface-soft)' }}
            content={<ChartTooltip format="money" currency={currency} locale={locale} />}
          />
          <Bar dataKey="value" name="sales" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** A horizontal bar chart, used for the names that are too long for an axis. */
export function HorizontalBarChart({
  data,
  currency,
  locale,
  format = 'money',
}: {
  data: readonly ChartDatum[];
  currency: string;
  locale: ReturnType<typeof useI18n>['locale'];
  format?: ChartFormat;
}) {
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
        <BarChart
          data={data as ChartDatum[]}
          layout="vertical"
          margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={110} />
          <Tooltip
            cursor={{ fill: 'var(--surface-soft)' }}
            content={<ChartTooltip format={format} currency={currency} locale={locale} />}
          />
          <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** The three buckets of the ageing of the credit. */
export function AgeingChart({
  data,
  currency,
  locale,
  labels,
}: {
  data: readonly ChartDatum[];
  currency: string;
  locale: ReturnType<typeof useI18n>['locale'];
  labels: readonly string[];
}) {
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data as ChartDatum[]} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={64} />
          <Tooltip
            cursor={{ fill: 'var(--surface-soft)' }}
            content={<ChartTooltip format="money" currency={currency} locale={locale} />}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={entry.key} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <ul className="chart-legend">
        {data.map((entry, index) => (
          <li key={entry.key}>
            <span className="chart-legend__mark" style={{ background: CHART_COLORS[index] }} />
            {labels[index] ?? entry.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The sales of every day of the week. */
export function WeekdayChart({
  data,
  currency,
  locale,
}: {
  data: readonly ChartDatum[];
  currency: string;
  locale: ReturnType<typeof useI18n>['locale'];
}) {
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data as ChartDatum[]} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            interval={0}
            angle={-30}
            textAnchor="end"
            height={52}
          />
          <YAxis tick={{ fontSize: 11 }} width={64} />
          <Tooltip
            cursor={{ fill: 'var(--surface-soft)' }}
            content={<ChartTooltip format="money" currency={currency} locale={locale} />}
          />
          <Bar dataKey="value" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** The purchases and the sales of every month. */
export function PurchasesVersusSalesChart({
  data,
  currency,
  locale,
  purchasesLabel,
  salesLabel,
}: {
  data: readonly PurchasesVersusSalesDatum[];
  currency: string;
  locale: ReturnType<typeof useI18n>['locale'];
  purchasesLabel: string;
  salesLabel: string;
}) {
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={data as PurchasesVersusSalesDatum[]}
          margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={64} />
          <Tooltip
            cursor={{ fill: 'var(--surface-soft)' }}
            content={<ChartTooltip format="money" currency={currency} locale={locale} />}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="purchases"
            name={purchasesLabel}
            fill={CHART_COLORS[1]}
            radius={[4, 4, 0, 0]}
          />
          <Bar dataKey="sales" name={salesLabel} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
