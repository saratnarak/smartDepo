import { Injectable, NotFoundException } from '@nestjs/common';

import { AUDIT_ACTIONS } from '../../common/audit/audit-actions.js';
import { findActivePlan, limitsOf } from '../../common/plans/plan-limits.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { AuthenticatedPrincipal } from '../../common/tenant/tenant-context.js';
import type { TenantScopedTransactionClient } from '../../common/tenant/tenant-scope.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PlanCode } from './dto/change-plan.dto.js';
import type { DepotPlanViewDto, PlanViewDto } from './dto/plan-view.dto.js';

const planSelect = {
  id: true,
  code: true,
  name: true,
  priceMonthly: true,
  maxUsers: true,
  maxProducts: true,
  isActive: true,
} as const;

function toPlanView(plan: {
  id: string;
  code: string;
  name: string;
  priceMonthly: Prisma.Decimal;
  maxUsers: number | null;
  maxProducts: number | null;
  isActive: boolean;
}): PlanViewDto {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    priceMonthly: plan.priceMonthly.toFixed(2),
    maxUsers: plan.maxUsers,
    maxProducts: plan.maxProducts,
    isActive: plan.isActive,
  };
}

/**
 * The subscription plans of the platform (FR-4). The billing is simulated: the price of a plan is
 * only shown in the interface, and no payment is ever taken.
 */
@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every plan of the platform. Platform Admin only. */
  async listPlans(principal: AuthenticatedPrincipal): Promise<PlanViewDto[]> {
    return this.prisma.runAsPlatformAdmin(principal, async (transaction) => {
      const plans = await transaction.plan.findMany({
        where: { isActive: true },
        select: planSelect,
        orderBy: { priceMonthly: 'asc' },
      });

      return plans.map(toPlanView);
    });
  }

  /**
   * The plan of the depot of the caller with the usage against the limits. The owner reads it; the
   * usage comes from the same tables the limits are checked against.
   */
  async getDepotPlan(principal: AuthenticatedPrincipal): Promise<DepotPlanViewDto> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const plan = await findActivePlan(transaction);
      const [activeUsers, activeProducts] = await Promise.all([
        transaction.user.count({ where: { isActive: true } }),
        transaction.product.count({ where: { isActive: true } }),
      ]);
      const limits = limitsOf(plan);

      return {
        plan: plan === null ? null : await this.planView(transaction, plan.code),
        usage: { users: activeUsers, products: activeProducts },
        limits,
        overLimit:
          (limits.users !== null && activeUsers > limits.users) ||
          (limits.products !== null && activeProducts > limits.products),
      };
    });
  }

  /**
   * Moves a depot to another plan. The old subscription is closed and a new one is started, so the
   * depot keeps the history of the plans it had. Platform Admin only.
   */
  async changeDepotPlan(
    principal: AuthenticatedPrincipal,
    depotId: string,
    planCode: PlanCode,
  ): Promise<DepotPlanViewDto> {
    return this.prisma.runAsPlatformAdmin(principal, async (transaction) => {
      const depot = await transaction.depot.findUnique({
        where: { id: depotId },
        select: { id: true, name: true },
      });

      if (depot === null) {
        throw new NotFoundException('Depot not found');
      }

      const plan = await transaction.plan.findFirst({
        where: { code: planCode, isActive: true },
        select: planSelect,
      });

      if (plan === null) {
        throw new NotFoundException('Plan not found');
      }

      const current = await transaction.subscription.findFirst({
        where: { depotId, status: 'ACTIVE' },
        orderBy: { startedAt: 'desc' },
        select: { id: true, plan: { select: { code: true, name: true } } },
      });

      if (current !== null) {
        await transaction.subscription.update({
          where: { id: current.id },
          data: { status: 'CANCELLED', endsAt: new Date() },
        });
      }

      await transaction.subscription.create({
        data: { depotId, planId: plan.id, status: 'ACTIVE', startedAt: new Date() },
      });

      await transaction.auditLog.create({
        data: {
          depotId,
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.DEPOT_PLAN_CHANGED,
          entityType: 'Depot',
          entityId: depotId,
          before: { planCode: current?.plan.code ?? null, planName: current?.plan.name ?? null },
          after: { planCode: plan.code, planName: plan.name },
          metadata: { depotName: depot.name },
        },
      });

      const [activeUsers, activeProducts] = await Promise.all([
        transaction.user.count({ where: { depotId, isActive: true } }),
        transaction.product.count({ where: { depotId, isActive: true } }),
      ]);
      const limits = { users: plan.maxUsers, products: plan.maxProducts };

      return {
        plan: toPlanView(plan),
        usage: { users: activeUsers, products: activeProducts },
        limits,
        overLimit:
          (limits.users !== null && activeUsers > limits.users) ||
          (limits.products !== null && activeProducts > limits.products),
      };
    });
  }

  /** The plan view of a plan code, for the depot path. */
  private async planView(
    transaction: TenantScopedTransactionClient,
    planCode: string,
  ): Promise<PlanViewDto> {
    const plan = await transaction.plan.findFirst({
      where: { code: planCode },
      select: planSelect,
    });

    if (plan === null) {
      throw new NotFoundException('Plan not found');
    }

    return toPlanView(plan);
  }
}
