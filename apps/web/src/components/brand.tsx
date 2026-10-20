'use client';

import Link from 'next/link';

import { useI18n } from '@/components/i18n-provider';

export function Brand({ href = '/' }: { href?: string }) {
  const { t } = useI18n();

  return (
    <Link className="brand" href={href} aria-label={t('app.name')}>
      <span className="brand__mark" aria-hidden="true">
        SD
      </span>
      <span className="brand__text">
        <strong>{t('app.name')}</strong>
        <small>{t('app.workspace')}</small>
      </span>
    </Link>
  );
}
