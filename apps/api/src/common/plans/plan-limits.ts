import { ConflictException } from '@nestjs/common';

import type { TenantScopedTransactionClient } from '../tenant/tenant-scope.js';

/** The plan every new depot starts with. */
export const FREE_TRIAL_PLAN_CODE = 'FREE_TRIAL';

export interface ActivePlan {
  code: string;
  name: string;
  maxUsers: number | null;
  maxProducts: number | null;
}

export interface PlanLimits {
  users: number | null;
  products: number | null;
}

/**
 * The plan of a depot. The subscription table is depot-scoped, so the tenant scope of the caller
 * already limits the search to the depot of the token. The platform path passes the depot id
 * explicitly.
 */
export async function findActivePlan(
  transaction: TenantScopedTransactionClient,
  depotId?: string,
): Promise<ActivePlan | null> {
  const subscription = await transaction.subscription.findFirst({
    where: {
      status: 'ACTIVE',
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      ...(depotId === undefined ? {} : { depotId }),
    },
    orderBy: { startedAt: 'desc' },
    select: {
      plan: { select: { code: true, name: true, maxUsers: true, maxProducts: true } },
    },
  });

  return subscription?.plan ?? null;
}

/**
 * Enforces the user limit of the plan (FR-4). A depot without a plan is not limited yet. The
 * error shape is the one the frontend already knows: details.reason is PLAN_USER_LIMIT_REACHED.
 */
export async function assertWithinUserLimit(
  transaction: TenantScopedTransactionClient,
  plan: ActivePlan | null,
): Promise<void> {
  const maxUsers = plan?.maxUsers ?? null;

  if (maxUsers === null) {
    return;
  }

  const activeUsers = await transaction.user.count({ where: { isActive: true } });

  if (activeUsers >= maxUsers) {
    const limitLabel = maxUsers === 1 ? 'user' : 'users';

    throw new ConflictException({
      message: `Your plan allows at most ${String(maxUsers)} active ${limitLabel}. Deactivate a staff member or upgrade the plan.`,
      details: { reason: 'PLAN_USER_LIMIT_REACHED', maxUsers, activeUsers },
    });
  }
}

/**
 * Enforces the product limit of the plan (FR-4). The same shape as the user limit:
 * details.reason is PLAN_PRODUCT_LIMIT_REACHED.
 */
export async function assertWithinProductLimit(
  transaction: TenantScopedTransactionClient,
  plan: ActivePlan | null,
): Promise<void> {
  const maxProducts = plan?.maxProducts ?? null;

  if (maxProducts === null) {
    return;
  }

  const activeProducts = await transaction.product.count({ where: { isActive: true } });

  if (activeProducts >= maxProducts) {
    throw new ConflictException({
      message: `Your plan allows at most ${String(maxProducts)} active products. Archive a product or upgrade the plan.`,
      details: { reason: 'PLAN_PRODUCT_LIMIT_REACHED', maxProducts, activeProducts },
    });
  }
}

/** The limits of a plan, or null when the plan has no limit. */
export function limitsOf(plan: ActivePlan | null): PlanLimits {
  return {
    users: plan?.maxUsers ?? null,
    products: plan?.maxProducts ?? null,
  };
}
