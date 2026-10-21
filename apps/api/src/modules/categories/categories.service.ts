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
import type { ListCategoriesQueryDto } from './dto/list-categories-query.dto.js';
import type { CreateCategoryDto } from './dto/create-category.dto.js';
import type { UpdateCategoryDto } from './dto/update-category.dto.js';

const categorySelect = {
  id: true,
  name: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

type CategoryRow = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>;

export interface CategoryView {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toView(category: CategoryRow): CategoryView {
  return category;
}

function categoryWhere(query: ListCategoriesQueryDto): Prisma.CategoryWhereInput {
  const search = query.search?.trim();

  return {
    ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    ...(search === undefined || search === ''
      ? {}
      : { name: { contains: search, mode: 'insensitive' } }),
  };
}

async function findDuplicateName(
  transaction: TenantScopedTransactionClient,
  name: string,
  excludeId?: string,
): Promise<boolean> {
  const duplicate = await transaction.category.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(excludeId === undefined ? {} : { id: { not: excludeId } }),
    },
    select: { id: true },
  });

  return duplicate !== null;
}

/**
 * Depot categories (FR-11). Categories are always scoped to the token depot. STOCK_KEEPER and
 * OWNER may manage them; SALES can see a product's category name through the product response.
 */
@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    principal: AuthenticatedPrincipal,
    query: ListCategoriesQueryDto,
  ): Promise<{
    data: CategoryView[];
    meta: { page: number; pageSize: number; total: number };
  }> {
    const context = TenantContext.fromPrincipal(principal);
    const where = categoryWhere(query);
    const skip = (query.page - 1) * query.pageSize;

    return this.prisma.runAsTenant(context, async (transaction) => {
      const [data, total] = await Promise.all([
        transaction.category.findMany({
          where,
          select: categorySelect,
          orderBy: { [query.sort]: query.order },
          skip,
          take: query.pageSize,
        }),
        transaction.category.count({ where }),
      ]);

      return {
        data: data.map(toView),
        meta: { page: query.page, pageSize: query.pageSize, total },
      };
    });
  }

  async create(principal: AuthenticatedPrincipal, dto: CreateCategoryDto): Promise<CategoryView> {
    const context = TenantContext.fromPrincipal(principal);

    try {
      return await this.prisma.runAsTenant(context, async (transaction) => {
        if (await findDuplicateName(transaction, dto.name)) {
          throw new ConflictException('A category with this name already exists');
        }

        const category = await transaction.category.create({
          data: { depotId: context.depotId, name: dto.name },
          select: categorySelect,
        });

        await transaction.auditLog.create({
          data: {
            actorUserId: principal.userId,
            action: AUDIT_ACTIONS.CATEGORY_CREATED,
            entityType: 'Category',
            entityId: category.id,
            after: category,
          },
        });

        return toView(category);
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A category with this name already exists');
      }
      throw error;
    }
  }

  async update(
    principal: AuthenticatedPrincipal,
    categoryId: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryView> {
    const name = dto.name;

    if (name === undefined) {
      throw new BadRequestException('At least one field must be provided');
    }

    const context = TenantContext.fromPrincipal(principal);

    try {
      return await this.prisma.runAsTenant(context, async (transaction) => {
        const existing = await transaction.category.findFirst({
          where: { id: categoryId },
          select: categorySelect,
        });

        if (existing === null) {
          throw new NotFoundException('Category not found');
        }

        if (await findDuplicateName(transaction, name, categoryId)) {
          throw new ConflictException('A category with this name already exists');
        }

        const category = await transaction.category.update({
          where: { id: categoryId },
          data: { name },
          select: categorySelect,
        });

        await transaction.auditLog.create({
          data: {
            actorUserId: principal.userId,
            action: AUDIT_ACTIONS.CATEGORY_UPDATED,
            entityType: 'Category',
            entityId: category.id,
            before: existing,
            after: category,
          },
        });

        return toView(category);
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A category with this name already exists');
      }
      throw error;
    }
  }

  async archive(principal: AuthenticatedPrincipal, categoryId: string): Promise<CategoryView> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const existing = await transaction.category.findFirst({
        where: { id: categoryId },
        select: categorySelect,
      });

      if (existing === null) {
        throw new NotFoundException('Category not found');
      }

      if (!existing.isActive) {
        return toView(existing);
      }

      const category = await transaction.category.update({
        where: { id: categoryId },
        data: { isActive: false },
        select: categorySelect,
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.CATEGORY_ARCHIVED,
          entityType: 'Category',
          entityId: category.id,
          before: existing,
          after: category,
        },
      });

      return toView(category);
    });
  }
}
