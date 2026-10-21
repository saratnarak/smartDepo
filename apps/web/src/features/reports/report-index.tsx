'use client';

import Link from 'next/link';

import { useI18n } from '@/components/i18n-provider';
import { useSessionStore } from '@/stores/session-store';
import { reportsForRole } from './report-registry';

/**
 * The index of the reports. It only shows the reports that the role of the session may read, so
 * the navigation and the tabs of the reports follow the same permission map as the API.
 */
export function ReportIndex() {
  const { t } = useI18n();
  const role = useSessionStore((state) => state.role) ?? 'OWNER';
  const reports = reportsForRole(role);

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t('reports.eyebrow')}</p>
          <h2>{t('reports.title')}</h2>
          <p className="muted">{t('reports.subtitle')}</p>
        </div>
      </section>

      <section className="report-index" aria-label={t('reports.title')}>
        {reports.map((report) => (
          <Link key={report.key} href={report.href} className="report-index__card">
            <strong>{t(report.labelKey)}</strong>
            <span>{t(report.descriptionKey)}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
