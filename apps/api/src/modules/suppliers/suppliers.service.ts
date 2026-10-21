import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AUDIT_ACTIONS } from '../../common/audit/audit-actions.js';
import { isUniqueConstraintError } from '../../common/prisma/prisma-errors.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { AuthenticatedPrincipal } from '../../common/tenant/tenant-context.js';
import type { TenantScopedTransactionClient } from '../../common/tenant/tenant-scope.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateSupplierDto } from './dto/create-supplier.dto.js';
import type { ListSuppliersQueryDto } from './dto/list-suppliers-query.dto.js';
import type { PaginatedSuppliersDto, SupplierDto } from './dto/supplier.dto.js';
import type { UpdateSupplierDto } from './dto/update-supplier.dto.js';

const supplierSelect = {
  id: true,
  name: true,
  contactName: true,
  phone: true,
  email: true,
  address: true,
  notes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

function supplierWhere(query: ListSuppliersQueryDto): Prisma.SupplierWhereInput {
  const search = query.search?.trim();

  return {
    ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    ...(search === undefined || search === ''
      ? {}
      : {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { contactName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        }),
  };
}

async function findDuplicateName(
  transaction: TenantScopedTransactionClient,
  name: string,
  excludeId?: string,
): Promise<boolean> {
  const duplicate = await transaction.supplier.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(excludeId === undefined ? {} : { id: { not: excludeId } }),
    },
    select: { id: true },
  });

  return duplicate !== null;
}

/**
 * Depot suppliers (FR-36). OWNER and STOCK_KEEPER manage them; other roles cannot read supplier
 * data. Archived suppliers stay on old purchases but cannot be used for new purchases.
 */
@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    principal: AuthenticatedPrincipal,
    query: ListSuppliersQueryDto,
  ): Promise<PaginatedSuppliersDto> {
    const context = TenantContext.fromPrincipal(principal);
    const where = supplierWhere(query);
    const skip = (query.page - 1) * query.pageSize;

    return this.prisma.runAsTenant(context, async (transaction) => {
      const [data, total] = await Promise.all([
        transaction.supplier.findMany({
          where,
          select: supplierSelect,
          orderBy: { [query.sort]: query.order },
          skip,
          take: query.pageSize,
        }),
        transaction.supplier.count({ where }),
      ]);

      return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
    });
  }

  async get(principal: AuthenticatedPrincipal, supplierId: string): Promise<SupplierDto> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const supplier = await transaction.supplier.findFirst({
        where: { id: supplierId },
        select: supplierSelect,
      });

      if (supplier === null) {
        throw new NotFoundException('Supplier not found');
      }

      return supplier;
    });
  }

  async create(principal: AuthenticatedPrincipal, dto: CreateSupplierDto): Promise<SupplierDto> {
    const context = TenantContext.fromPrincipal(principal);

    try {
      return await this.prisma.runAsTenant(context, async (transaction) => {
        if (await findDuplicateName(transaction, dto.name)) {
          throw new ConflictException('A supplier with this name already exists');
        }

        const supplier = await transaction.supplier.create({
          data: {
            depotId: context.depotId,
            name: dto.name,
            contactName: dto.contactName ?? null,
            phone: dto.phone ?? null,
            email: dto.email ?? null,
            address: dto.address ?? null,
            notes: dto.notes ?? null,
          },
          select: supplierSelect,
        });

        await transaction.auditLog.create({
          data: {
            actorUserId: principal.userId,
            action: AUDIT_ACTIONS.SUPPLIER_CREATED,
            entityType: 'Supplier',
            entityId: supplier.id,
            after: supplier,
          },
        });

        return supplier;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A supplier with this name already exists');
      }
      throw error;
    }
  }

  async update(
    principal: AuthenticatedPrincipal,
    supplierId: string,
    dto: UpdateSupplierDto,
  ): Promise<SupplierDto> {
    if (
      dto.name === undefined &&
      dto.contactName === undefined &&
      dto.phone === undefined &&
      dto.email === undefined &&
      dto.address === undefined &&
      dto.notes === undefined
    ) {
      throw new BadRequestException('At least one field must be provided');
    }

    const context = TenantContext.fromPrincipal(principal);

    try {
      return await this.prisma.runAsTenant(context, async (transaction) => {
        const existing = await transaction.supplier.findFirst({
          where: { id: supplierId },
          select: supplierSelect,
        });

        if (existing === null) {
          throw new NotFoundException('Supplier not found');
        }

        if (
          dto.name !== undefined &&
          (await findDuplicateName(transaction, dto.name, supplierId))
        ) {
          throw new ConflictException('A supplier with this name already exists');
        }

        const supplier = await transaction.supplier.update({
          where: { id: supplierId },
          data: {
            ...(dto.name === undefined ? {} : { name: dto.name }),
            ...(dto.contactName === undefined ? {} : { contactName: dto.contactName }),
            ...(dto.phone === undefined ? {} : { phone: dto.phone }),
            ...(dto.email === undefined ? {} : { email: dto.email }),
            ...(dto.address === undefined ? {} : { address: dto.address }),
            ...(dto.notes === undefined ? {} : { notes: dto.notes }),
          },
          select: supplierSelect,
        });

        await transaction.auditLog.create({
          data: {
            actorUserId: principal.userId,
            action: AUDIT_ACTIONS.SUPPLIER_UPDATED,
            entityType: 'Supplier',
            entityId: supplier.id,
            before: existing,
            after: supplier,
          },
        });

        return supplier;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A supplier with this name already exists');
      }
      throw error;
    }
  }

  async archive(principal: AuthenticatedPrincipal, supplierId: string): Promise<SupplierDto> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const existing = await transaction.supplier.findFirst({
        where: { id: supplierId },
        select: supplierSelect,
      });

      if (existing === null) {
        throw new NotFoundException('Supplier not found');
      }
      if (!existing.isActive) {
        return existing;
      }

      const supplier = await transaction.supplier.update({
        where: { id: supplierId },
        data: { isActive: false },
        select: supplierSelect,
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.SUPPLIER_ARCHIVED,
          entityType: 'Supplier',
          entityId: supplier.id,
          before: existing,
          after: supplier,
        },
      });

      return supplier;
    });
  }
}
