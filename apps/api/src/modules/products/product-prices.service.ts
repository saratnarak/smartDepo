import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { AUDIT_ACTIONS } from '../../common/audit/audit-actions.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { AuthenticatedPrincipal } from '../../common/tenant/tenant-context.js';
import type { TenantScopedTransactionClient } from '../../common/tenant/tenant-scope.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { PriceType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PriceHistoryQueryDto, PaginatedPriceHistoryDto } from './dto/price-history.dto.js';
import type { PriceDto } from './dto/price.dto.js';
import type { SetPriceDto } from './dto/set-price.dto.js';

const priceSelect = {
  id: true,
  productUnitId: true,
  type: true,
  amount: true,
  updatedAt: true,
} as const;

type PriceRow = Prisma.PriceGetPayload<{ select: typeof priceSelect }>;

function toView(price: PriceRow): PriceDto {
  return {
    id: price.id,
    productUnitId: price.productUnitId,
    type: price.type,
    amount: price.amount.toFixed(2),
    updatedAt: price.updatedAt,
  };
}

interface UnitForPrice {
  id: string;
  isActive: boolean;
}

async function findActiveUnit(
  transaction: TenantScopedTransactionClient,
  productId: string,
  unitId: string,
): Promise<UnitForPrice> {
  const product = await transaction.product.findFirst({
    where: { id: productId },
    select: {
      id: true,
      isActive: true,
      productUnits: {
        where: { id: unitId },
        select: { id: true, isActive: true },
      },
    },
  });

  if (product === null) {
    throw new NotFoundException('Product not found');
  }
  if (!product.isActive) {
    throw new BadRequestException('Archived products cannot be changed');
  }

  const unit = product.productUnits[0];

  if (unit === undefined) {
    throw new NotFoundException('Product unit not found');
  }
  if (!unit.isActive) {
    throw new BadRequestException('Archived product units cannot be priced');
  }

  return unit;
}

/**
 * Price management (FR-16). Only OWNER may change prices. Every actual amount change creates an
 * immutable price_history row and an audit entry. SALES and STOCK_KEEPER read prices through the
 * product response.
 */
@Injectable()
export class ProductPricesService {
  constructor(private readonly prisma: PrismaService) {}

  async history(
    principal: AuthenticatedPrincipal,
    productId: string,
    query: PriceHistoryQueryDto,
  ): Promise<PaginatedPriceHistoryDto> {
    const context = TenantContext.fromPrincipal(principal);
    const skip = (query.page - 1) * query.pageSize;

    return this.prisma.runAsTenant(context, async (transaction) => {
      const product = await transaction.product.findFirst({
        where: { id: productId },
        select: { id: true },
      });

      if (product === null) {
        throw new NotFoundException('Product not found');
      }

      const rows = await transaction.priceHistory.findMany({
        where: {
          productId,
          ...(query.unitId === undefined ? {} : { productUnitId: query.unitId }),
          ...(query.type === undefined ? {} : { type: query.type }),
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          productId: true,
          productUnitId: true,
          type: true,
          amount: true,
          createdAt: true,
          productUnit: { select: { name: true } },
          changedBy: { select: { id: true, name: true } },
        },
      });

      const previousAmounts = new Map<string, string>();
      const entries = rows.map((row) => {
        const key = `${row.productUnitId}:${row.type}`;
        const oldAmount = previousAmounts.get(key) ?? null;
        const newAmount = row.amount.toFixed(2);
        previousAmounts.set(key, newAmount);

        return {
          id: row.id,
          productId: row.productId,
          productUnitId: row.productUnitId,
          productUnitName: row.productUnit.name,
          type: row.type,
          oldAmount,
          newAmount,
          changedBy: row.changedBy,
          createdAt: row.createdAt,
        };
      });

      return {
        data: entries.reverse().slice(skip, skip + query.pageSize),
        meta: { page: query.page, pageSize: query.pageSize, total: entries.length },
      };
    });
  }

  async setPrice(
    principal: AuthenticatedPrincipal,
    productId: string,
    unitId: string,
    type: PriceType,
    dto: SetPriceDto,
  ): Promise<PriceDto> {
    const context = TenantContext.fromPrincipal(principal);
    const amount = new Prisma.Decimal(dto.amount);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const unit = await findActiveUnit(transaction, productId, unitId);

      const existing = await transaction.price.findFirst({
        where: { productUnitId: unit.id, type },
        select: priceSelect,
      });

      if (existing !== null && existing.amount.eq(amount)) {
        return toView(existing);
      }

      const price =
        existing === null
          ? await transaction.price.create({
              data: {
                depotId: context.depotId,
                productUnitId: unit.id,
                type,
                amount,
              },
              select: priceSelect,
            })
          : await transaction.price.update({
              where: { id: existing.id },
              data: { amount },
              select: priceSelect,
            });

      await transaction.priceHistory.create({
        data: {
          depotId: context.depotId,
          priceId: price.id,
          productId,
          productUnitId: unit.id,
          type,
          amount,
          changedById: principal.userId,
        },
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.PRICE_CHANGED,
          entityType: 'Price',
          entityId: price.id,
          before: existing === null ? undefined : { amount: existing.amount.toFixed(2) },
          after: { amount: price.amount.toFixed(2), type },
        },
      });

      return toView(price);
    });
  }
}
