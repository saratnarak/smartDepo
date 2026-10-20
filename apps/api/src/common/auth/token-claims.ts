import type { UserRole } from '../tenant/tenant-context.js';

export interface TokenClaims {
  sub: string;
  role: UserRole;
  depotId: string | null;
  type: 'access' | 'refresh';
}
