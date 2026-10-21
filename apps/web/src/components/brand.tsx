'use client';

import Image from 'next/image';
import Link from 'next/link';

import { useI18n } from '@/components/i18n-provider';

export function Brand({ href = '/' }: { href?: string }) {
  const { t } = useI18n();

  return (
    <Link className="brand" href={href}>
      <Image
        className="brand__mark"
        src="/brand/logo-mark.svg"
        alt={t('app.name')}
        width={52}
        height={52}
        priority
        unoptimized
      />
      <span className="brand__text" aria-hidden="true">
        <strong>{t('app.name')}</strong>
        <small>{t('app.workspace')}</small>
      </span>
    </Link>
  );
}
