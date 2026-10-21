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
import {
  assertBaseConversionFactor,
  assertNonBaseConversionFactor,
} from '../../common/units/quantity.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateProductUnitDto } from './dto/create-product-unit.dto.js';
import type { ProductUnitDto } from './dto/product.dto.js';
import type { UpdateProductUnitDto } from './dto/update-product-unit.dto.js';

const unitSelect = {
  id: true,
  name: true,
  conversionFactor: true,
  isBaseUnit: true,
  isActive: true,
  prices: {
    orderBy: { type: 'asc' },
    select: { id: true, type: true, amount: true, updatedAt: true },
  },
} as const;

type UnitRow = Prisma.ProductUnitGetPayload<{ select: typeof unitSelect }>;

interface UnitView {
  id: string;
  name: string;
  conversionFactor: string;
  isBaseUnit: boolean;
  isActive: boolean;
  prices: Array<{ id: string; type: string; amount: string; updatedAt: Date }>;
}

function toView(unit: UnitRow): UnitView {
  return {
    id: unit.id,
    name: unit.name,
    conversionFactor: unit.conversionFactor.toString(),
    isBaseUnit: unit.isBaseUnit,
    isActive: unit.isActive,
    prices: unit.prices.map((price) => ({
      id: price.id,
      type: price.type,
      amount: price.amount.toFixed(2),
      updatedAt: price.updatedAt,
    })),
  };
}

function decimalOrBadRequest(work: () => Prisma.Decimal): Prisma.Decimal {
  try {
    return work();
  } catch (error) {
    if (error instanceof RangeError) {
      throw new BadRequestException(error.message);
    }
    throw error;
  }
}

function unitAuditView(unit: UnitView) {
  return {
    name: unit.name,
    conversionFactor: unit.conversionFactor,
    isBaseUnit: unit.isBaseUnit,
    isActive: unit.isActive,
  };
}

async function findUnit(
  transaction: TenantScopedTransactionClient,
  productId: string,
  unitId: string,
): Promise<UnitRow | null> {
  return transaction.productUnit.findFirst({
    where: { id: unitId, productId },
    select: unitSelect,
  });
}

async function findDuplicateUnitName(
  transaction: TenantScopedTransactionClient,
  productId: string,
  name: string,
  excludeId?: string,
): Promise<boolean> {
  const duplicate = await transaction.productUnit.findFirst({
    where: {
      productId,
      name: { equals: name, mode: 'insensitive' },
      ...(excludeId === undefined ? {} : { id: { not: excludeId } }),
    },
    select: { id: true },
  });

  return duplicate !== null;
}

/**
 * Product units (FR-13). The base unit is created with the product and keeps factor 1. Additional
 * units are positive factors different from 1. Quantities are always converted to the base unit.
 */
@Injectable()
export class ProductUnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    principal: AuthenticatedPrincipal,
    productId: string,
    dto: CreateProductUnitDto,
  ): Promise<ProductUnitDto> {
    const context = TenantContext.fromPrincipal(principal);
    decimalOrBadRequest(() => assertNonBaseConversionFactor(dto.conversionFactor));

    try {
      return await this.prisma.runAsTenant(context, async (transaction) => {
        const product = await transaction.product.findFirst({
          where: { id: productId },
          select: { id: true, isActive: true },
        });

        if (product === null) {
          throw new NotFoundException('Product not found');
        }
        if (!product.isActive) {
          throw new BadRequestException('Archived products cannot be changed');
        }
        if (await findDuplicateUnitName(transaction, productId, dto.name)) {
          throw new ConflictException('A unit with this name already exists for this product');
        }

        const unit = await transaction.productUnit.create({
          data: {
            depotId: context.depotId,
            productId,
            name: dto.name,
            conversionFactor: new Prisma.Decimal(dto.conversionFactor),
            isBaseUnit: false,
          },
          select: unitSelect,
        });

        await transaction.auditLog.create({
          data: {
            actorUserId: principal.userId,
            action: AUDIT_ACTIONS.PRODUCT_UNIT_CREATED,
            entityType: 'ProductUnit',
            entityId: unit.id,
            after: unitAuditView(toView(unit)),
          },
        });

        return toView(unit);
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A unit with this name already exists for this product');
      }
      throw error;
    }
  }

  async update(
    principal: AuthenticatedPrincipal,
    productId: string,
    unitId: string,
    dto: UpdateProductUnitDto,
  ): Promise<ProductUnitDto> {
    if (dto.name === undefined && dto.conversionFactor === undefined) {
      throw new BadRequestException('At least one field must be provided');
    }

    const context = TenantContext.fromPrincipal(principal);

    try {
      return await this.prisma.runAsTenant(context, async (transaction) => {
        const product = await transaction.product.findFirst({
          where: { id: productId },
          select: { id: true, isActive: true },
        });

        if (product === null) {
          throw new NotFoundException('Product not found');
        }
        if (!product.isActive) {
          throw new BadRequestException('Archived products cannot be changed');
        }

        const existing = await findUnit(transaction, productId, unitId);

        if (existing === null) {
          throw new NotFoundException('Product unit not found');
        }

        if (dto.conversionFactor !== undefined) {
          decimalOrBadRequest(() =>
            existing.isBaseUnit
              ? assertBaseConversionFactor(dto.conversionFactor as string)
              : assertNonBaseConversionFactor(dto.conversionFactor as string),
          );
        }

        if (
          dto.name !== undefined &&
          (await findDuplicateUnitName(transaction, productId, dto.name, unitId))
        ) {
          throw new ConflictException('A unit with this name already exists for this product');
        }

        const unit = await transaction.productUnit.update({
          where: { id: unitId },
          data: {
            ...(dto.name === undefined ? {} : { name: dto.name }),
            ...(dto.conversionFactor === undefined
              ? {}
              : { conversionFactor: new Prisma.Decimal(dto.conversionFactor) }),
          },
          select: unitSelect,
        });

        await transaction.auditLog.create({
          data: {
            actorUserId: principal.userId,
            action: AUDIT_ACTIONS.PRODUCT_UNIT_UPDATED,
            entityType: 'ProductUnit',
            entityId: unit.id,
            before: unitAuditView(toView(existing)),
            after: unitAuditView(toView(unit)),
          },
        });

        return toView(unit);
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A unit with this name already exists for this product');
      }
      throw error;
    }
  }

  async archive(
    principal: AuthenticatedPrincipal,
    productId: string,
    unitId: string,
  ): Promise<ProductUnitDto> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const existing = await findUnit(transaction, productId, unitId);

      if (existing === null) {
        throw new NotFoundException('Product unit not found');
      }
      if (existing.isBaseUnit) {
        throw new BadRequestException('The base unit cannot be archived');
      }
      if (!existing.isActive) {
        return toView(existing);
      }

      const unit = await transaction.productUnit.update({
        where: { id: unitId },
        data: { isActive: false },
        select: unitSelect,
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.PRODUCT_UNIT_ARCHIVED,
          entityType: 'ProductUnit',
          entityId: unit.id,
          before: unitAuditView(toView(existing)),
          after: unitAuditView(toView(unit)),
        },
      });

      return toView(unit);
    });
  }
}
