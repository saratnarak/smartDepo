'use client';

import { useI18n } from '@/components/i18n-provider';
import type { DepotStatus } from '@/lib/types';

export function StatusBadge({ status }: { status: DepotStatus }) {
  const { t } = useI18n();

  return (
    <span className={`status-badge status-badge--${status.toLowerCase()}`}>
      <span className="status-badge__dot" aria-hidden="true" />
      {t(`status.${status}`)}
    </span>
  );
}
