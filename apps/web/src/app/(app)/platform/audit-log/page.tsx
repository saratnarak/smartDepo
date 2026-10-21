'use client';

import { AuditLogManager } from '@/features/audit-log/audit-log-manager';

export default function PlatformAuditLogPage() {
  return <AuditLogManager scope="platform" />;
}
