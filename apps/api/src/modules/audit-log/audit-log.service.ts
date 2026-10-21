import { Injectable } from '@nestjs/common';

import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { AuthenticatedPrincipal } from '../../common/tenant/tenant-context.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { sanitizeAuditJson } from './audit-sanitizer.js';
import type { ListAuditLogQueryDto } from './dto/list-audit-log-query.dto.js';
import type { AuditLogEntryDto } from './dto/audit-log-view.dto.js';

const auditSelect = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  ipAddress: true,
  before: true,
  after: true,
  metadata: true,
  createdAt: true,
  actor: { select: { id: true, name: true, role: { select: { code: true } } } },
} as const;

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  createdAt: Date;
  actor: { id: string; name: string; role: { code: string } } | null;
}

function toView(row: AuditRow): AuditLogEntryDto {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    actor:
      row.actor === null
        ? null
        : { id: row.actor.id, name: row.actor.name, role: row.actor.role.code },
    ipAddress: row.ipAddress,
    before: sanitizeAuditJson(row.before) as Record<string, unknown> | null,
    after: sanitizeAuditJson(row.after) as Record<string, unknown> | null,
    metadata: sanitizeAuditJson(row.metadata) as Record<string, unknown> | null,
    createdAt: row.createdAt,
  };
}

/**
 * The audit log (FR-50, FR-51). The log is append-only: there is no endpoint to change or to
 * remove an entry, and the database refuses the update and the delete even for the Platform Admin.
 * The owner reads the log of the depot, and the Platform Admin reads the entries of the platform.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(query: ListAuditLogQueryDto): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (query.action !== undefined) {
      where.action = query.action;
    }

    if (query.actorUserId !== undefined) {
      where.actorUserId = query.actorUserId;
    }

    if (query.entityType !== undefined) {
      where.entityType = query.entityType;
    }

    const createdAt: Record<string, Date> = {};

    if (query.from !== undefined) {
      createdAt.gte = new Date(query.from);
    }

    if (query.to !== undefined) {
      createdAt.lte = new Date(query.to);
    }

    if (Object.keys(createdAt).length > 0) {
      where.createdAt = createdAt;
    }

    return where;
  }

  /** The log of the depot of the caller. The owner only. */
  async listDepotEntries(
    principal: AuthenticatedPrincipal,
    query: ListAuditLogQueryDto,
  ): Promise<{
    data: AuditLogEntryDto[];
    meta: { page: number; pageSize: number; total: number };
  }> {
    const context = TenantContext.fromPrincipal(principal);
    const where = this.buildWhere(query);
    const skip = (query.page - 1) * query.pageSize;

    return this.prisma.runAsTenant(context, async (transaction) => {
      const [rows, total] = await Promise.all([
        transaction.auditLog.findMany({
          where,
          select: auditSelect,
          orderBy: { [query.sort]: query.order },
          skip,
          take: query.pageSize,
        }),
        transaction.auditLog.count({ where }),
      ]);

      return {
        data: rows.map(toView),
        meta: { page: query.page, pageSize: query.pageSize, total },
      };
    });
  }

  /**
   * The entries of the platform: the actions that are not tied to a depot, like the approval of a
   * depot or a login of a Platform Admin. Platform Admin only.
   */
  async listPlatformEntries(
    principal: AuthenticatedPrincipal,
    query: ListAuditLogQueryDto,
  ): Promise<{
    data: AuditLogEntryDto[];
    meta: { page: number; pageSize: number; total: number };
  }> {
    const where = { ...this.buildWhere(query), depotId: null };
    const skip = (query.page - 1) * query.pageSize;

    return this.prisma.runAsPlatformAdmin(principal, async (transaction) => {
      const [rows, total] = await Promise.all([
        transaction.auditLog.findMany({
          where,
          select: auditSelect,
          orderBy: { [query.sort]: query.order },
          skip,
          take: query.pageSize,
        }),
        transaction.auditLog.count({ where }),
      ]);

      return {
        data: rows.map(toView),
        meta: { page: query.page, pageSize: query.pageSize, total },
      };
    });
  }
}
