import { ForbiddenException } from '@nestjs/common';

import type { PrismaClient } from '../generated/prisma/client.js';

type RawQueryClient = Pick<PrismaClient, '$queryRaw'>;

/**
 * Sets the PostgreSQL session variables that the RLS policies read. `set_config(..., true)` is
 * transaction-local, so this only works inside the interactive transaction opened by
 * PrismaService.runAsTenant / runAsPlatformAdmin.
 *
 * Raw SQL is confined to apps/api/src/prisma (enforced by ESLint) and uses tagged templates, so the
 * depot id is parameterized rather than string-built.
 */
export async function setTenantSession(client: RawQueryClient, depotId: string): Promise<void> {
  if (depotId.trim() === '') {
    throw new ForbiddenException('Tenant session requires a depot id');
  }

  await client.$queryRaw`SELECT set_config('app.depot_id', ${depotId}, true), set_config('app.is_platform_admin', 'false', true)`;
}

export async function setPlatformAdminSession(client: RawQueryClient): Promise<void> {
  await client.$queryRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
}
