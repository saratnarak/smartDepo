'use client';

import Link from 'next/link';

import { AuthCard } from '@/components/auth-card';
import { useI18n } from '@/components/i18n-provider';

export function PendingStatus({ registered }: { registered: boolean }) {
  const { t } = useI18n();

  return (
    <AuthCard
      title={registered ? t('pending.registeredTitle') : t('pending.title')}
      subtitle={registered ? t('pending.registeredMessage') : t('pending.subtitle')}
      footer={
        <p>
          <Link href="/login">{t('pending.backToLogin')}</Link>
        </p>
      }
    >
      <div className="status-icon status-icon--pending" aria-hidden="true">
        <span>⌛</span>
      </div>

      <section className="status-section" aria-labelledby="pending-next-title">
        <h2 id="pending-next-title">{t('pending.whatNext')}</h2>
        <ol className="status-steps">
          <li>{t('pending.stepReview')}</li>
          <li>{t('pending.stepDecision')}</li>
          <li>{t('pending.stepSignIn')}</li>
        </ol>
      </section>

      <p className="status-note">{t('pending.checkLater')}</p>
    </AuthCard>
  );
}
