import { SetMetadata } from '@nestjs/common';

import type { Permission } from './permissions.js';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Declares the permissions an endpoint requires. Omitting this decorator on a non-public endpoint is
 * a bug: the PermissionsGuard rejects it by default.
 */
export const RequirePermissions = (
  ...permissions: readonly Permission[]
): MethodDecorator & ClassDecorator => SetMetadata(PERMISSIONS_KEY, permissions);
