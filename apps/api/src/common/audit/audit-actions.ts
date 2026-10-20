/** Audit action names shared by auth and platform-admin services. */
export const AUDIT_ACTIONS = {
  DEPOT_REGISTERED: 'DEPOT_REGISTERED',
  DEPOT_APPROVED: 'DEPOT_APPROVED',
  DEPOT_REJECTED: 'DEPOT_REJECTED',
  DEPOT_SUSPENDED: 'DEPOT_SUSPENDED',
  USER_LOGIN: 'USER_LOGIN',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
