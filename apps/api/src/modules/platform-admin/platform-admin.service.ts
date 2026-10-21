import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { AUDIT_ACTIONS } from '../../common/audit/audit-actions.js';
import type { AuthenticatedPrincipal } from '../../common/tenant/tenant-context.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ListDepotsQueryDto } from './dto/list-depots-query.dto.js';
import type { PlatformDashboardDto } from './dto/platform-dashboard.dto.js';

/** The name of the default cash customer of a depot. */
export const WALK_IN_CUSTOMER_NAME = 'Walk-in';

export interface DepotAdminPlanView {
  code: string;
  name: string;
}

export interface DepotAdminView {
  id: string;
  name: string;
  slug: string;
  phone: string;
  email: string;
  status: string;
  statusReason: string | null;
  approvedAt: Date | null;
  /** The active plan of the depot, or null when the depot has no plan. */
  plan: DepotAdminPlanView | null;
  createdAt: Date;
  updatedAt: Date;
}

const depotSelect = {
  id: true,
  name: true,
  slug: true,
  phone: true,
  email: true,
  status: true,
  statusReason: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
  subscriptions: {
    where: { status: 'ACTIVE' },
    take: 1,
    select: { plan: { select: { code: true, name: true } } },
  },
} as const;

type DepotRow = {
  id: string;
  name: string;
  slug: string;
  phone: string;
  email: string;
  status: string;
  statusReason: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  subscriptions: Array<{ plan: { code: string; name: string } }>;
};

/** The depot with the plan it has, for the platform screens. */
function toDepotView(depot: DepotRow): DepotAdminView {
  return {
    id: depot.id,
    name: depot.name,
    slug: depot.slug,
    phone: depot.phone,
    email: depot.email,
    status: depot.status,
    statusReason: depot.statusReason,
    approvedAt: depot.approvedAt,
    plan: depot.subscriptions[0]?.plan ?? null,
    createdAt: depot.createdAt,
    updatedAt: depot.updatedAt,
  };
}

@Injectable()
export class PlatformAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listDepots(
    principal: AuthenticatedPrincipal,
    query: ListDepotsQueryDto,
  ): Promise<{ data: DepotAdminView[]; meta: { page: number; pageSize: number; total: number } }> {
    const where = query.status === undefined ? {} : { status: query.status };
    const skip = (query.page - 1) * query.pageSize;

    return this.prisma.runAsPlatformAdmin(principal, async (transaction) => {
      const [data, total] = await Promise.all([
        transaction.depot.findMany({
          where,
          select: depotSelect,
          orderBy: { [query.sort]: query.order },
          skip,
          take: query.pageSize,
        }),
        transaction.depot.count({ where }),
      ]);

      return {
        data: data.map(toDepotView),
        meta: { page: query.page, pageSize: query.pageSize, total },
      };
    });
  }

  async getDepot(principal: AuthenticatedPrincipal, depotId: string): Promise<DepotAdminView> {
    return this.prisma.runAsPlatformAdmin(principal, async (transaction) => {
      const depot = await transaction.depot.findUnique({
        where: { id: depotId },
        select: depotSelect,
      });

      if (depot === null) {
        throw new NotFoundException('Depot not found');
      }

      return toDepotView(depot);
    });
  }

  async approveDepot(principal: AuthenticatedPrincipal, depotId: string): Promise<DepotAdminView> {
    return this.prisma.runAsPlatformAdmin(principal, async (transaction) => {
      const depot = await transaction.depot.findUnique({
        where: { id: depotId },
        select: depotSelect,
      });

      if (depot === null) {
        throw new NotFoundException('Depot not found');
      }

      if (depot.status === 'APPROVED') {
        return toDepotView(depot);
      }

      const updated = await transaction.depot.update({
        where: { id: depotId },
        data: { status: 'APPROVED', approvedAt: new Date(), statusReason: null },
        select: depotSelect,
      });

      await this.ensureWalkInCustomer(transaction, depotId);

      await transaction.auditLog.create({
        data: {
          depotId,
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.DEPOT_APPROVED,
          entityType: 'Depot',
          entityId: depotId,
          before: { status: depot.status },
          after: { status: updated.status },
        },
      });

      return toDepotView(updated);
    });
  }

  /** Every depot gets a default cash customer as soon as it is approved. */
  private async ensureWalkInCustomer(
    transaction: Prisma.TransactionClient,
    depotId: string,
  ): Promise<void> {
    const existing = await transaction.customer.findFirst({
      where: { depotId, isWalkIn: true },
      select: { id: true },
    });

    if (existing !== null) {
      return;
    }

    await transaction.customer.create({
      data: {
        depotId,
        name: WALK_IN_CUSTOMER_NAME,
        type: 'RETAIL',
        notes: 'Default cash customer',
        isActive: true,
        isWalkIn: true,
      },
      select: { id: true },
    });
  }

  async rejectDepot(
    principal: AuthenticatedPrincipal,
    depotId: string,
    reason: string,
  ): Promise<DepotAdminView> {
    return this.prisma.runAsPlatformAdmin(principal, async (transaction) => {
      const depot = await transaction.depot.findUnique({
        where: { id: depotId },
        select: depotSelect,
      });

      if (depot === null) {
        throw new NotFoundException('Depot not found');
      }

      if (depot.status !== 'PENDING') {
        throw new ConflictException('Only a pending depot can be rejected');
      }

      const updated = await transaction.depot.update({
        where: { id: depotId },
        data: { status: 'REJECTED', statusReason: reason, approvedAt: null },
        select: depotSelect,
      });

      await transaction.auditLog.create({
        data: {
          depotId,
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.DEPOT_REJECTED,
          entityType: 'Depot',
          entityId: depotId,
          before: { status: depot.status },
          after: { status: updated.status, reason },
        },
      });

      return toDepotView(updated);
    });
  }

  async suspendDepot(
    principal: AuthenticatedPrincipal,
    depotId: string,
    reason: string,
  ): Promise<DepotAdminView> {
    return this.prisma.runAsPlatformAdmin(principal, async (transaction) => {
      const depot = await transaction.depot.findUnique({
        where: { id: depotId },
        select: depotSelect,
      });

      if (depot === null) {
        throw new NotFoundException('Depot not found');
      }

      if (depot.status !== 'APPROVED' && depot.status !== 'SUSPENDED') {
        throw new ConflictException('Only an approved depot can be suspended');
      }

      const updated = await transaction.depot.update({
        where: { id: depotId },
        data: { status: 'SUSPENDED', statusReason: reason },
        select: depotSelect,
      });

      await transaction.auditLog.create({
        data: {
          depotId,
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.DEPOT_SUSPENDED,
          entityType: 'Depot',
          entityId: depotId,
          before: { status: depot.status },
          after: { status: updated.status, reason },
        },
      });

      return toDepotView(updated);
    });
  }

  /**
   * The data of the platform dashboard (FR-5): the depots that registered over time, the active
   * depots, the depots per plan, and the approvals that wait.
   */
  async dashboard(principal: AuthenticatedPrincipal): Promise<PlatformDashboardDto> {
    return this.prisma.runAsPlatformAdmin(principal, async (transaction) => {
      const depots = await transaction.depot.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          subscriptions: {
            where: { status: 'ACTIVE' },
            select: { plan: { select: { code: true, name: true } } },
            take: 1,
          },
        },
      });

      const registered = new Map<string, number>();

      for (const depot of depots) {
        const period = depot.createdAt.toISOString().slice(0, 7);
        registered.set(period, (registered.get(period) ?? 0) + 1);
      }

      const byPlan = new Map<string, number>();

      for (const depot of depots) {
        const plan = depot.subscriptions[0]?.plan.name ?? 'No plan';

        byPlan.set(plan, (byPlan.get(plan) ?? 0) + 1);
      }

      const pending = depots.filter((depot) => depot.status === 'PENDING');

      return {
        totalDepots: depots.length,
        activeDepots: depots.filter((depot) => depot.status === 'APPROVED').length,
        pendingApprovals: pending.length,
        registeredOverTime: [...registered.entries()].map(([period, count]) => ({
          period,
          registered: count,
        })),
        depotsByPlan: [...byPlan.entries()].map(([plan, count]) => ({ plan, depots: count })),
        pendingDepots: pending.map((depot) => ({
          depotId: depot.id,
          name: depot.name,
          createdAt: depot.createdAt,
        })),
      };
    });
  }
}
