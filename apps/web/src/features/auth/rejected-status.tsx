'use client';

import Link from 'next/link';

import { AuthCard } from '@/components/auth-card';
import { useI18n } from '@/components/i18n-provider';

export function RejectedStatus() {
  const { t } = useI18n();

  return (
    <AuthCard
      title={t('rejected.title')}
      footer={
        <p>
          <Link href="/login">{t('rejected.backToLogin')}</Link>
        </p>
      }
    >
      <div className="status-icon status-icon--rejected" aria-hidden="true">
        <span>×</span>
      </div>
      <p className="status-message">{t('rejected.message')}</p>
      <p className="status-message status-message--strong">{t('rejected.next')}</p>
      <p className="status-note">{t('rejected.contact')}</p>
    </AuthCard>
  );
}
