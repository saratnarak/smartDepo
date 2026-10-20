'use client';

import Link from 'next/link';

import { AuthCard } from '@/components/auth-card';
import { useI18n } from '@/components/i18n-provider';

export function SuspendedStatus() {
  const { t } = useI18n();

  return (
    <AuthCard
      title={t('suspended.title')}
      footer={
        <p>
          <Link href="/login">{t('suspended.backToLogin')}</Link>
        </p>
      }
    >
      <div className="status-icon status-icon--suspended" aria-hidden="true">
        <span>!</span>
      </div>
      <p className="status-message">{t('suspended.message')}</p>
      <p className="status-message status-message--strong">{t('suspended.next')}</p>
      <p className="status-note">{t('suspended.contact')}</p>
    </AuthCard>
  );
}
