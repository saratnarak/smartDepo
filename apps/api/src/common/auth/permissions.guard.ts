import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedPrincipal } from '../tenant/tenant-context.js';
import { ROLE_PERMISSIONS } from './permissions.js';
import type { Permission } from './permissions.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { PERMISSIONS_KEY } from './require-permissions.decorator.js';

interface RequestWithAuth {
  user?: AuthenticatedPrincipal;
}

/**
 * Global authorisation guard backed by the code permission map. It is default-deny: a route without
 * @RequirePermissions is rejected, and every required permission must be granted to the caller's
 * role. OWNER inherits the SALES and STOCK_KEEPER permission sets through ROLE_PERMISSIONS.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic === true) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<readonly Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<RequestWithAuth>();

    if (request.user === undefined) {
      throw new UnauthorizedException('Authentication required');
    }

    if (required === undefined || required.length === 0) {
      throw new ForbiddenException('Endpoint permissions are not configured');
    }

    const allowed = ROLE_PERMISSIONS[request.user.role];

    if (allowed === undefined || !required.every((permission) => allowed.has(permission))) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
