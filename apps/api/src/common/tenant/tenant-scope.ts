import { ForbiddenException } from '@nestjs/common';

import type { PrismaClient } from '../../generated/prisma/client.js';
import type { TenantContext } from './tenant-context.js';
import { isDepotScopedModel } from './tenant-models.js';

type QueryArgs = Record<string, unknown>;

function isRecord(value: unknown): value is QueryArgs {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertDepotValue(value: unknown, depotId: string): void {
  if (value !== undefined && value !== depotId) {
    throw new ForbiddenException('Cross-tenant depot id rejected');
  }
}

function withDepotWhere(where: unknown, depotId: string): QueryArgs {
  if (where !== undefined && !isRecord(where)) {
    throw new Error('Tenant-scoped query received an invalid where clause');
  }
  const base = isRecord(where) ? where : {};
  assertDepotValue(base.depotId, depotId);
  return { ...base, depotId };
}

function withDepotOnCreate(data: unknown, depotId: string): QueryArgs {
  if (!isRecord(data)) {
    throw new Error('Tenant-scoped create requires a data object');
  }
  assertDepotValue(data.depotId, depotId);
  return { ...data, depotId };
}

function withDepotOnCreateMany(data: unknown, depotId: string): QueryArgs | QueryArgs[] {
  if (Array.isArray(data)) {
    return data.map((item) => withDepotOnCreate(item, depotId));
  }
  if (isRecord(data)) {
    return withDepotOnCreate(data, depotId);
  }
  throw new Error('Tenant-scoped createMany requires a data object or array');
}

function withDepotOnUpdate(data: unknown, depotId: string): unknown {
  if (data === undefined) {
    return data;
  }
  if (!isRecord(data)) {
    throw new Error('Tenant-scoped update requires a data object');
  }
  assertDepotValue(data.depotId, depotId);
  return data;
}

/**
 * Adds the token's depot_id to a Prisma operation.
 *
 * Reads, counts, aggregates, updates and deletes get depot_id in `where`; creates get it in `data`.
 * A caller-supplied depot_id that differs from the token depot is rejected instead of silently
 * overwritten. Nested writes (for example creating invoice lines inside a sales order) are not
 * rewritten here: services must pass depot_id explicitly on nested rows and keep them inside the
 * same transaction.
 */
export function scopeQueryArgs(
  operation: string,
  args: QueryArgs | undefined,
  depotId: string,
): QueryArgs {
  if (depotId.trim() === '') {
    throw new ForbiddenException('Tenant scope requires a depot id');
  }

  const base = args ?? {};

  switch (operation) {
    case 'create':
      return { ...base, data: withDepotOnCreate(base.data, depotId) };
    case 'createMany':
    case 'createManyAndReturn':
      return { ...base, data: withDepotOnCreateMany(base.data, depotId) };
    case 'upsert':
      return {
        ...base,
        where: withDepotWhere(base.where, depotId),
        create: withDepotOnCreate(base.create, depotId),
        update: withDepotOnUpdate(base.update, depotId),
      };
    case 'update':
    case 'updateMany':
    case 'updateManyAndReturn':
      return {
        ...base,
        where: withDepotWhere(base.where, depotId),
        data: withDepotOnUpdate(base.data, depotId),
      };
    case 'findUnique':
    case 'findUniqueOrThrow':
    case 'findFirst':
    case 'findFirstOrThrow':
    case 'findMany':
    case 'count':
    case 'aggregate':
    case 'groupBy':
    case 'delete':
    case 'deleteMany':
      return { ...base, where: withDepotWhere(base.where, depotId) };
    default:
      throw new Error(`Unsupported tenant-scoped Prisma operation: ${operation}`);
  }
}

/**
 * Wraps a Prisma client so every operation on a depot-owned model is filtered or stamped with the
 * depot from the authenticated user's token. Platform-level models pass through unchanged; platform
 * admins must use PrismaService.runAsPlatformAdmin instead of this scope.
 */
export function applyTenantScope(client: PrismaClient, context: TenantContext) {
  return client.$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!isDepotScopedModel(model)) {
            return query(args);
          }

          // Prisma types args per model/operation; the scoped copy keeps the same shape.
          const scopedArgs = scopeQueryArgs(
            operation,
            args as unknown as QueryArgs,
            context.depotId,
          );
          return query(scopedArgs as typeof args);
        },
      },
    },
  });
}

export type TenantScopedClient = ReturnType<typeof applyTenantScope>;

export type TenantScopedTransactionClient = Omit<
  TenantScopedClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
