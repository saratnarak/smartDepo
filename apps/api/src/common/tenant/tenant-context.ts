import { ForbiddenException } from '@nestjs/common';

export const PLATFORM_ADMIN_ROLE = 'PLATFORM_ADMIN' as const;

export const DEPOT_ROLES = ['OWNER', 'SALES', 'STOCK_KEEPER', 'DELIVERY'] as const;

export type DepotRole = (typeof DEPOT_ROLES)[number];

export type UserRole = DepotRole | typeof PLATFORM_ADMIN_ROLE;

/**
 * Claims taken from the authenticated user's access token. The auth layer (Phase 2) builds this
 * from the verified JWT; depotId must never be filled from a request body, query, or URL.
 */
export interface AuthenticatedPrincipal {
  readonly userId: string;
  readonly role: UserRole;
  readonly depotId?: string | null;
}

export interface PlatformAdminPrincipal extends AuthenticatedPrincipal {
  readonly role: typeof PLATFORM_ADMIN_ROLE;
}

function isDepotRole(role: string): role is DepotRole {
  return (DEPOT_ROLES as readonly string[]).includes(role);
}

export function isUserRole(role: string): role is UserRole {
  return role === PLATFORM_ADMIN_ROLE || isDepotRole(role);
}

/**
 * The depot a request acts on. It can only be built from token claims, so callers cannot inject a
 * depot id from request input. OWNER keeps a single role and is treated as a superset of SALES and
 * STOCK_KEEPER by the future permission checks.
 */
export class TenantContext {
  private constructor(
    public readonly userId: string,
    public readonly depotId: string,
    public readonly role: DepotRole,
  ) {}

  static fromPrincipal(principal: AuthenticatedPrincipal): TenantContext {
    if (principal.role === PLATFORM_ADMIN_ROLE) {
      throw new ForbiddenException(
        'Platform admin users must use the separate platform admin data path',
      );
    }

    const depotId = principal.depotId?.trim();
    if (depotId === undefined || depotId === '') {
      throw new ForbiddenException('Authenticated user has no depot in their token');
    }

    if (!isDepotRole(principal.role)) {
      throw new ForbiddenException('Authenticated user has an unknown role');
    }

    if (principal.userId.trim() === '') {
      throw new ForbiddenException('Authenticated user id is missing');
    }

    return new TenantContext(principal.userId, depotId, principal.role);
  }
}

export function assertPlatformAdmin(
  principal: AuthenticatedPrincipal,
): asserts principal is PlatformAdminPrincipal {
  if (principal.role !== PLATFORM_ADMIN_ROLE) {
    throw new ForbiddenException('Platform admin role required');
  }
}
