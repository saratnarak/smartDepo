import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { requireEnv } from '../config/env.js';
import { isUserRole, PLATFORM_ADMIN_ROLE } from '../tenant/tenant-context.js';
import type { AuthenticatedPrincipal } from '../tenant/tenant-context.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import type { TokenClaims } from './token-claims.js';

interface RequestWithAuth {
  headers: Record<string, string | undefined>;
  user?: AuthenticatedPrincipal;
}

/**
 * Global authentication guard. Everything is authenticated unless explicitly marked @Public.
 * Access tokens are verified with the access secret; refresh tokens are rejected here because they
 * carry type "refresh".
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || token === undefined || token === '') {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const claims = await this.jwtService.verifyAsync<TokenClaims>(token, {
        secret: requireEnv('JWT_ACCESS_SECRET'),
      });

      if (
        claims.type !== 'access' ||
        claims.sub === '' ||
        !isUserRole(claims.role) ||
        (claims.role !== PLATFORM_ADMIN_ROLE && (claims.depotId ?? '') === '')
      ) {
        throw new UnauthorizedException('Authentication required');
      }

      request.user = {
        userId: claims.sub,
        role: claims.role,
        depotId: claims.depotId ?? null,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Authentication required');
    }
  }
}
