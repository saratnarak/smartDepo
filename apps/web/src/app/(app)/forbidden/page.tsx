'use client';

import Link from 'next/link';

import { useI18n } from '@/components/i18n-provider';

export default function ForbiddenPage() {
  const { t } = useI18n();

  return (
    <div className="centered-state">
      <section className="panel narrow-panel">
        <div className="status-icon status-icon--rejected" aria-hidden="true">
          <span>!</span>
        </div>
        <h2>{t('forbidden.title')}</h2>
        <p className="muted">{t('forbidden.message')}</p>
        <Link className="button button--primary" href="/dashboard">
          {t('forbidden.backToDashboard')}
        </Link>
      </section>
    </div>
  );
}
