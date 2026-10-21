import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AUDIT_ACTIONS } from '../../common/audit/audit-actions.js';
import { assertWithinProductLimit, findActivePlan } from '../../common/plans/plan-limits.js';
import { isUniqueConstraintError } from '../../common/prisma/prisma-errors.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { AuthenticatedPrincipal } from '../../common/tenant/tenant-context.js';
import type { TenantScopedTransactionClient } from '../../common/tenant/tenant-scope.js';
import {
  assertNonBaseConversionFactor,
  assertNonNegativeQuantity,
} from '../../common/units/quantity.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { Prisma as PrismaTypes } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StockLedgerService } from '../stock/stock-ledger.service.js';
import type { CreateProductUnitDto } from './dto/create-product-unit.dto.js';
import type { CreateProductDto } from './dto/create-product.dto.js';
import type { ListProductsQueryDto } from './dto/list-products-query.dto.js';
import type { UpdateProductDto } from './dto/update-product.dto.js';
import { productSelect, toProductView } from './product-select.js';
import type { ProductView } from './product-select.js';

function productWhere(query: ListProductsQueryDto): PrismaTypes.ProductWhereInput {
  const search = query.search?.trim();

  return {
    ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
    ...(search === undefined || search === ''
      ? {}
      : {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
          ],
        }),
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

function assertUniqueUnitNames(baseUnit: string, units: readonly CreateProductUnitDto[]): void {
  const names = new Set<string>([baseUnit.toLowerCase()]);

  for (const unit of units) {
    const key = unit.name.toLowerCase();

    if (names.has(key)) {
      throw new BadRequestException('Unit names must be unique within a product');
    }

    names.add(key);
    decimalOrBadRequest(() => assertNonBaseConversionFactor(unit.conversionFactor));
  }
}

async function assertActiveCategory(
  transaction: TenantScopedTransactionClient,
  categoryId: string,
): Promise<void> {
  const category = await transaction.category.findFirst({
    where: { id: categoryId, isActive: true },
    select: { id: true },
  });

  if (category === null) {
    throw new BadRequestException('Category not found or archived');
  }
}

async function findProductBySku(
  transaction: TenantScopedTransactionClient,
  sku: string,
  excludeId?: string,
): Promise<boolean> {
  const product = await transaction.product.findFirst({
    where: {
      sku,
      ...(excludeId === undefined ? {} : { id: { not: excludeId } }),
    },
    select: { id: true },
  });

  return product !== null;
}

function productAuditView(product: ProductView) {
  return {
    sku: product.sku,
    name: product.name,
    categoryId: product.category?.id ?? null,
    reorderLevel: product.reorderLevel,
    trackBatches: product.trackBatches,
    isActive: product.isActive,
    units: product.units.map((unit) => ({
      name: unit.name,
      conversionFactor: unit.conversionFactor,
      isBaseUnit: unit.isBaseUnit,
      isActive: unit.isActive,
    })),
  };
}

/**
 * Product catalog (FR-12). Products always belong to the token depot. STOCK_KEEPER and OWNER manage
 * them; SALES can read them and the prices embedded in the product response. Archived products stay
 * readable for old records but the stock and purchase services must reject them for new documents.
 */
@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockLedgerService,
  ) {}

  async list(
    principal: AuthenticatedPrincipal,
    query: ListProductsQueryDto,
  ): Promise<{
    data: ProductView[];
    meta: { page: number; pageSize: number; total: number };
  }> {
    const context = TenantContext.fromPrincipal(principal);
    const where = productWhere(query);
    const skip = (query.page - 1) * query.pageSize;

    return this.prisma.runAsTenant(context, async (transaction) => {
      const [data, total] = await Promise.all([
        transaction.product.findMany({
          where,
          select: productSelect,
          orderBy: { [query.sort]: query.order },
          skip,
          take: query.pageSize,
        }),
        transaction.product.count({ where }),
      ]);
      const stock = await this.stock.currentStockForProducts(
        transaction,
        data.map((product) => product.id),
      );

      return {
        data: data.map((product) =>
          toProductView(product, stock.get(product.id) ?? new Prisma.Decimal(0)),
        ),
        meta: { page: query.page, pageSize: query.pageSize, total },
      };
    });
  }

  async get(principal: AuthenticatedPrincipal, productId: string): Promise<ProductView> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const product = await transaction.product.findFirst({
        where: { id: productId },
        select: productSelect,
      });

      if (product === null) {
        throw new NotFoundException('Product not found');
      }

      return toProductView(product, await this.stock.currentStock(transaction, productId));
    });
  }

  async create(principal: AuthenticatedPrincipal, dto: CreateProductDto): Promise<ProductView> {
    const context = TenantContext.fromPrincipal(principal);
    const units = dto.units ?? [];
    assertUniqueUnitNames(dto.baseUnit, units);
    const reorderLevel = decimalOrBadRequest(() =>
      assertNonNegativeQuantity(dto.reorderLevel ?? '0'),
    );

    try {
      return await this.prisma.runAsTenant(context, async (transaction) => {
        if (dto.categoryId !== undefined && dto.categoryId !== null) {
          await assertActiveCategory(transaction, dto.categoryId);
        }

        if (await findProductBySku(transaction, dto.sku)) {
          throw new ConflictException('A product with this SKU already exists');
        }

        // The plan of the depot limits the number of products (FR-4).
        await assertWithinProductLimit(transaction, await findActivePlan(transaction));

        const product = await transaction.product.create({
          data: {
            depotId: context.depotId,
            sku: dto.sku,
            name: dto.name,
            description: dto.description ?? null,
            categoryId: dto.categoryId ?? null,
            reorderLevel,
            trackBatches: dto.trackBatches ?? false,
            productUnits: {
              create: [
                {
                  depotId: context.depotId,
                  name: dto.baseUnit,
                  conversionFactor: new Prisma.Decimal(1),
                  isBaseUnit: true,
                },
                ...units.map((unit) => ({
                  depotId: context.depotId,
                  name: unit.name,
                  conversionFactor: new Prisma.Decimal(unit.conversionFactor),
                  isBaseUnit: false,
                })),
              ],
            },
          },
          select: productSelect,
        });

        const view = toProductView(product);

        await transaction.auditLog.create({
          data: {
            actorUserId: principal.userId,
            action: AUDIT_ACTIONS.PRODUCT_CREATED,
            entityType: 'Product',
            entityId: product.id,
            after: productAuditView(view),
          },
        });

        return view;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('The product SKU or a unit name already exists');
      }
      throw error;
    }
  }

  async update(
    principal: AuthenticatedPrincipal,
    productId: string,
    dto: UpdateProductDto,
  ): Promise<ProductView> {
    if (
      dto.sku === undefined &&
      dto.name === undefined &&
      dto.description === undefined &&
      dto.categoryId === undefined &&
      dto.reorderLevel === undefined &&
      dto.trackBatches === undefined
    ) {
      throw new BadRequestException('At least one field must be provided');
    }

    const context = TenantContext.fromPrincipal(principal);

    try {
      return await this.prisma.runAsTenant(context, async (transaction) => {
        const existing = await transaction.product.findFirst({
          where: { id: productId },
          select: productSelect,
        });

        if (existing === null) {
          throw new NotFoundException('Product not found');
        }

        if (dto.categoryId !== undefined && dto.categoryId !== null) {
          await assertActiveCategory(transaction, dto.categoryId);
        }

        if (dto.sku !== undefined && (await findProductBySku(transaction, dto.sku, productId))) {
          throw new ConflictException('A product with this SKU already exists');
        }

        const product = await transaction.product.update({
          where: { id: productId },
          data: {
            ...(dto.sku === undefined ? {} : { sku: dto.sku }),
            ...(dto.name === undefined ? {} : { name: dto.name }),
            ...(dto.description === undefined ? {} : { description: dto.description }),
            ...(dto.categoryId === undefined ? {} : { categoryId: dto.categoryId }),
            ...(dto.reorderLevel === undefined
              ? {}
              : {
                  reorderLevel: decimalOrBadRequest(() =>
                    assertNonNegativeQuantity(dto.reorderLevel as string),
                  ),
                }),
            ...(dto.trackBatches === undefined ? {} : { trackBatches: dto.trackBatches }),
          },
          select: productSelect,
        });

        const view = toProductView(product, await this.stock.currentStock(transaction, product.id));

        await transaction.auditLog.create({
          data: {
            actorUserId: principal.userId,
            action: AUDIT_ACTIONS.PRODUCT_UPDATED,
            entityType: 'Product',
            entityId: product.id,
            before: productAuditView(toProductView(existing)),
            after: productAuditView(view),
          },
        });

        return view;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A product with this SKU already exists');
      }
      throw error;
    }
  }

  async archive(principal: AuthenticatedPrincipal, productId: string): Promise<ProductView> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const existing = await transaction.product.findFirst({
        where: { id: productId },
        select: productSelect,
      });

      if (existing === null) {
        throw new NotFoundException('Product not found');
      }

      if (!existing.isActive) {
        return toProductView(existing);
      }

      const product = await transaction.product.update({
        where: { id: productId },
        data: { isActive: false },
        select: productSelect,
      });
      const view = toProductView(product, await this.stock.currentStock(transaction, product.id));

      await transaction.auditLog.create({
        data: {
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.PRODUCT_ARCHIVED,
          entityType: 'Product',
          entityId: product.id,
          before: productAuditView(toProductView(existing)),
          after: productAuditView(view),
        },
      });

      return view;
    });
  }
}
