'use client';

import { AuditLogManager } from '@/features/audit-log/audit-log-manager';

export default function AuditLogPage() {
  return <AuditLogManager scope="depot" />;
}
