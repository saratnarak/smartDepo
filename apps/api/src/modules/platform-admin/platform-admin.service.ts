import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { AUDIT_ACTIONS } from '../../common/audit/audit-actions.js';
import type { AuthenticatedPrincipal } from '../../common/tenant/tenant-context.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ListDepotsQueryDto } from './dto/list-depots-query.dto.js';

export interface DepotAdminView {
  id: string;
  name: string;
  slug: string;
  phone: string;
  email: string;
  status: string;
  rejectionReason: string | null;
  approvedAt: Date | null;
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
  rejectionReason: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

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

      return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
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

      return depot;
    });
  }

  async approveDepot(principal: AuthenticatedPrincipal, depotId: string): Promise<DepotAdminView> {
    return this.prisma.runAsPlatformAdmin(principal, async (transaction) => {
      const depot = await transaction.depot.findUnique({ where: { id: depotId } });

      if (depot === null) {
        throw new NotFoundException('Depot not found');
      }

      if (depot.status === 'APPROVED') {
        return depot;
      }

      const updated = await transaction.depot.update({
        where: { id: depotId },
        data: { status: 'APPROVED', approvedAt: new Date(), rejectionReason: null },
        select: depotSelect,
      });

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

      return updated;
    });
  }

  async rejectDepot(
    principal: AuthenticatedPrincipal,
    depotId: string,
    reason: string,
  ): Promise<DepotAdminView> {
    return this.prisma.runAsPlatformAdmin(principal, async (transaction) => {
      const depot = await transaction.depot.findUnique({ where: { id: depotId } });

      if (depot === null) {
        throw new NotFoundException('Depot not found');
      }

      if (depot.status === 'APPROVED' || depot.status === 'SUSPENDED') {
        throw new ConflictException('Only a pending depot can be rejected');
      }

      const updated = await transaction.depot.update({
        where: { id: depotId },
        data: { status: 'REJECTED', rejectionReason: reason, approvedAt: null },
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

      return updated;
    });
  }

  async suspendDepot(
    principal: AuthenticatedPrincipal,
    depotId: string,
    reason: string,
  ): Promise<DepotAdminView> {
    return this.prisma.runAsPlatformAdmin(principal, async (transaction) => {
      const depot = await transaction.depot.findUnique({ where: { id: depotId } });

      if (depot === null) {
        throw new NotFoundException('Depot not found');
      }

      if (depot.status !== 'APPROVED' && depot.status !== 'SUSPENDED') {
        throw new ConflictException('Only an approved depot can be suspended');
      }

      const updated = await transaction.depot.update({
        where: { id: depotId },
        data: { status: 'SUSPENDED' },
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

      return updated;
    });
  }
}
