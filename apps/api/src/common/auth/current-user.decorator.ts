import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import type { AuthenticatedPrincipal } from '../tenant/tenant-context.js';

interface RequestWithAuth {
  user?: AuthenticatedPrincipal;
}

/**
 * Injects the principal set by JwtAuthGuard. Only use on routes protected by the global guards.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedPrincipal | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const principal = request.user;

    if (principal === undefined) {
      return undefined;
    }

    return field === undefined ? principal : principal[field];
  },
);
