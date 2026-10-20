'use client';

import { useI18n } from '@/components/i18n-provider';

export function FullPageLoading({ label }: { label?: string }) {
  const { t } = useI18n();

  return (
    <div className="full-page-loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
}
