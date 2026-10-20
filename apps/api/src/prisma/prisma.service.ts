import { Injectable } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { requireEnv } from '../common/config/env.js';
import { applyTenantScope } from '../common/tenant/tenant-scope.js';
import type { TenantScopedTransactionClient } from '../common/tenant/tenant-scope.js';
import { assertPlatformAdmin } from '../common/tenant/tenant-context.js';
import type { AuthenticatedPrincipal, TenantContext } from '../common/tenant/tenant-context.js';
import { PrismaClient } from '../generated/prisma/client.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  findAuthUser,
  getAuthUser,
  recordLoginFailure,
  recordLoginSuccess,
} from './auth-repository.js';
import type { AuthUserRecord } from './auth-repository.js';
import { setPlatformAdminSession, setTenantSession } from './tenant-session.js';

/**
 * Owns the single Prisma client. The base client is private on purpose: application code must go
 * through runAsTenant (normal depot request) or runAsPlatformAdmin (explicit platform-admin path).
 *
 * Both entry points open an interactive transaction and set the PostgreSQL session variables that
 * the row-level security policies read with `SET LOCAL`-style `set_config(..., true)`. The tenant
 * path also applies the Prisma extension that filters every depot-owned model by the token's depot.
 * As a result a query without an explicit transaction has no tenant session and reads no rows:
 * RLS fails closed by default.
 *
 * The connection is opened lazily on the first query, so unit tests that never touch the database
 * do not need a running PostgreSQL. onModuleDestroy closes the pool; main.ts enables shutdown hooks.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly client: PrismaClient;

  constructor() {
    this.client = new PrismaClient({
      adapter: new PrismaPg({ connectionString: requireEnv('DATABASE_URL') }),
    });
  }

  /**
   * Runs work inside a transaction scoped to the depot in the authenticated user's token. The
   * callback receives a client where depot-owned models are filtered by depot_id (Prisma layer) and
   * constrained by RLS (database layer).
   */
  runAsTenant<T>(
    context: TenantContext,
    work: (client: TenantScopedTransactionClient) => Promise<T>,
  ): Promise<T> {
    const scoped = applyTenantScope(this.client, context);

    return scoped.$transaction(async (transaction) => {
      await setTenantSession(transaction, context.depotId);
      // The transaction client comes from the already-extended client, so model operations keep the
      // tenant extension. The cast only restates the generated type without the transaction-denied
      // methods that $transaction removes.
      return work(transaction as unknown as TenantScopedTransactionClient);
    });
  }

  /**
   * Explicit cross-depot path for the Platform Admin. Access is denied unless the token role is
   * PLATFORM_ADMIN, and RLS allows the transaction through via app.is_platform_admin instead of
   * a superuser or BYPASSRLS connection.
   */
  runAsPlatformAdmin<T>(
    principal: AuthenticatedPrincipal,
    work: (client: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    assertPlatformAdmin(principal);

    return this.client.$transaction(async (transaction) => {
      await setPlatformAdminSession(transaction);
      return work(transaction);
    });
  }

  /**
   * Dedicated registration path. A brand-new depot has no authenticated tenant yet, so the caller
   * generates the depot id first and this transaction sets app.depot_id to that id. The depots RLS
   * policy then allows only that new row to be inserted/returned; registration never gets a general
   * cross-depot bypass.
   */
  runForDepotRegistration<T>(
    depotId: string,
    work: (client: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(async (transaction) => {
      await setTenantSession(transaction, depotId);
      return work(transaction);
    });
  }

  authFindUser(identifier: string): Promise<AuthUserRecord | null> {
    return findAuthUser(this.client, identifier);
  }

  authGetUser(userId: string): Promise<AuthUserRecord | null> {
    return getAuthUser(this.client, userId);
  }

  recordLoginSuccess(userId: string): Promise<void> {
    return recordLoginSuccess(this.client, userId);
  }

  recordLoginFailure(userId: string, maxAttempts: number, lockedUntil: Date): Promise<void> {
    return recordLoginFailure(this.client, userId, maxAttempts, lockedUntil);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
