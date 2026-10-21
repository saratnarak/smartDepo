import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { AUDIT_ACTIONS } from '../../common/audit/audit-actions.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { AuthenticatedPrincipal } from '../../common/tenant/tenant-context.js';
import type { TenantScopedTransactionClient } from '../../common/tenant/tenant-scope.js';
import {
  assertNonZeroQuantity,
  assertPositiveQuantity,
  formatBaseQuantity,
  toBaseQuantity,
} from '../../common/units/quantity.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { StockMovementType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { productSelect, toProductView } from '../products/product-select.js';
import type { ProductRow, ProductView } from '../products/product-select.js';
import type { AdjustStockDto } from './dto/adjust-stock.dto.js';
import type { BatchAlertsQueryDto } from './dto/batch-alerts-query.dto.js';
import type { DamageStockDto } from './dto/damage-stock.dto.js';
import type { ListMovementsQueryDto } from './dto/list-movements-query.dto.js';
import type { ListStockQueryDto } from './dto/list-stock-query.dto.js';
import type {
  BatchAlertsDto,
  PaginatedStockDto,
  PaginatedStockMovementsDto,
  StockAdjustmentResultDto,
  StockBatchDto,
  StockMovementDto,
} from './dto/stock.dto.js';
import { StockLedgerService } from './stock-ledger.service.js';
import { damageQuantity } from './stock-calculations.js';

interface BatchRow {
  id: string;
  productId: string;
  batchNumber: string;
  expiryDate: Date | null;
}

interface MovementRow {
  id: string;
  type: StockMovementType;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal | null;
  reason: string | null;
  saleOrderId: string | null;
  purchaseOrderId: string | null;
  createdAt: Date;
  product: {
    id: string;
    sku: string;
    name: string;
    productUnits: Array<{
      name: string;
      conversionFactor: Prisma.Decimal;
      isBaseUnit: boolean;
      isActive: boolean;
    }>;
  };
  batch: { id: string; batchNumber: string; expiryDate: Date | null } | null;
  createdBy: { id: string; name: string } | null;
}

interface AlertBatchRow extends BatchRow {
  product: {
    id: string;
    sku: string;
    name: string;
    productUnits: Array<{
      name: string;
      conversionFactor: Prisma.Decimal;
      isBaseUnit: boolean;
      isActive: boolean;
    }>;
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

function stockItem(
  product: ProductRow,
  currentStock: Prisma.Decimal,
  batches: readonly BatchRow[],
  batchStock: ReadonlyMap<string, Prisma.Decimal>,
): ProductView & { batches: StockBatchDto[] } {
  const view = toProductView(product, currentStock);

  const batchViews: StockBatchDto[] = product.trackBatches
    ? batches
        .map((batch) => {
          const quantity = batchStock.get(batch.id) ?? new Prisma.Decimal(0);
          return {
            id: batch.id,
            batchNumber: batch.batchNumber,
            expiryDate: batch.expiryDate,
            currentStock: quantity.toString(),
            currentStockReadable: formatBaseQuantity(quantity, view.units),
          };
        })
        .filter((batch) => !new Prisma.Decimal(batch.currentStock).isZero())
    : [];

  return { ...view, batches: batchViews };
}

function compareStockItems(
  left: ProductView,
  right: ProductView,
  sort: ListStockQueryDto['sort'],
): number {
  if (sort === 'currentStock') {
    return new Prisma.Decimal(left.currentStock).comparedTo(new Prisma.Decimal(right.currentStock));
  }

  return sort === 'sku' ? left.sku.localeCompare(right.sku) : left.name.localeCompare(right.name);
}

async function findProductAndUnit(
  transaction: TenantScopedTransactionClient,
  productId: string,
  unitId: string,
): Promise<{ product: ProductRow; unit: ProductRow['productUnits'][number] }> {
  const product = await transaction.product.findFirst({
    where: { id: productId },
    select: productSelect,
  });

  if (product === null) {
    throw new NotFoundException('Product not found');
  }
  if (!product.isActive) {
    throw new BadRequestException('Archived products cannot receive stock movements');
  }

  const unit = product.productUnits.find((candidate) => candidate.id === unitId);

  if (unit === undefined) {
    throw new NotFoundException('Product unit not found');
  }
  if (!unit.isActive) {
    throw new BadRequestException('Archived product units cannot be used');
  }

  return { product, unit };
}

async function assertBatch(
  transaction: TenantScopedTransactionClient,
  productId: string,
  batchId: string | null | undefined,
  trackBatches: boolean,
): Promise<string | null> {
  if (batchId === null || batchId === undefined) {
    if (trackBatches) {
      throw new BadRequestException('A batch is required for a product that tracks batches');
    }

    return null;
  }

  const batch = await transaction.batch.findFirst({
    where: { id: batchId, productId },
    select: { id: true },
  });

  if (batch === null) {
    throw new NotFoundException('Batch not found for this product');
  }

  return batch.id;
}

/**
 * Stock queries and manual movements (FR-17 to FR-22). Every quantity is stored in the product base
 * unit; readable values use the same conversion helpers as the catalog. Stock is never written
 * directly: adjustments and damage create ledger rows through StockLedgerService.
 */
@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedgerService,
  ) {}

  async list(
    principal: AuthenticatedPrincipal,
    query: ListStockQueryDto,
  ): Promise<PaginatedStockDto> {
    const context = TenantContext.fromPrincipal(principal);

    return this.listWithContext(context, query);
  }

  async lowStock(
    principal: AuthenticatedPrincipal,
    query: ListStockQueryDto,
  ): Promise<PaginatedStockDto> {
    const context = TenantContext.fromPrincipal(principal);
    return this.listWithContext(context, {
      ...query,
      lowStock: true,
      isActive: query.isActive ?? true,
    });
  }

  async movements(
    principal: AuthenticatedPrincipal,
    query: ListMovementsQueryDto,
  ): Promise<PaginatedStockMovementsDto> {
    const context = TenantContext.fromPrincipal(principal);
    const skip = (query.page - 1) * query.pageSize;
    const from = query.from === undefined ? undefined : new Date(query.from);
    const to = query.to === undefined ? undefined : new Date(query.to);
    const where: Prisma.StockMovementWhereInput = {
      ...(query.productId === undefined ? {} : { productId: query.productId }),
      ...(query.type === undefined ? {} : { type: query.type }),
      ...(from === undefined && to === undefined
        ? {}
        : {
            createdAt: {
              ...(from === undefined ? {} : { gte: from }),
              ...(to === undefined ? {} : { lte: to }),
            },
          }),
    };

    return this.prisma.runAsTenant(context, async (transaction) => {
      const [rows, total] = await Promise.all([
        transaction.stockMovement.findMany({
          where,
          skip,
          take: query.pageSize,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            quantity: true,
            unitCost: true,
            reason: true,
            saleOrderId: true,
            purchaseOrderId: true,
            createdAt: true,
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                productUnits: {
                  select: {
                    name: true,
                    conversionFactor: true,
                    isBaseUnit: true,
                    isActive: true,
                  },
                },
              },
            },
            batch: { select: { id: true, batchNumber: true, expiryDate: true } },
            createdBy: { select: { id: true, name: true } },
          },
        }),
        transaction.stockMovement.count({ where }),
      ]);

      return {
        data: rows.map((row) => this.toMovementView(row as MovementRow)),
        meta: { page: query.page, pageSize: query.pageSize, total },
      };
    });
  }

  async adjust(
    principal: AuthenticatedPrincipal,
    dto: AdjustStockDto,
  ): Promise<StockAdjustmentResultDto> {
    const context = TenantContext.fromPrincipal(principal);
    const enteredQuantity = decimalOrBadRequest(() => assertNonZeroQuantity(dto.quantity));

    return this.prisma.runAsTenant(context, async (transaction) => {
      const { product, unit } = await findProductAndUnit(transaction, dto.productId, dto.unitId);
      const batchId = await assertBatch(
        transaction,
        dto.productId,
        dto.batchId,
        product.trackBatches,
      );
      const quantityBase = toBaseQuantity(enteredQuantity, unit.conversionFactor);
      const recorded = await this.ledger.recordMovement(transaction, {
        depotId: context.depotId,
        userId: principal.userId,
        productId: product.id,
        type: 'ADJUSTMENT',
        quantity: quantityBase,
        reason: dto.reason,
        batchId,
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.STOCK_ADJUSTED,
          entityType: 'StockMovement',
          entityId: recorded.movementId,
          after: {
            productId: product.id,
            unitId: unit.id,
            quantityBase: quantityBase.toString(),
            reason: dto.reason,
            batchId,
            stockAfter: recorded.stockAfter.toString(),
          },
        },
      });

      const view = toProductView(product, recorded.stockAfter);

      return {
        movementId: recorded.movementId,
        type: 'ADJUSTMENT',
        quantity: quantityBase.toString(),
        quantityReadable: formatBaseQuantity(quantityBase, view.units),
        stockAfter: recorded.stockAfter.toString(),
        stockAfterReadable: view.currentStockReadable,
      };
    });
  }

  async damage(
    principal: AuthenticatedPrincipal,
    dto: DamageStockDto,
  ): Promise<StockAdjustmentResultDto> {
    const context = TenantContext.fromPrincipal(principal);
    const enteredQuantity = decimalOrBadRequest(() => assertPositiveQuantity(dto.quantity));

    return this.prisma.runAsTenant(context, async (transaction) => {
      const { product, unit } = await findProductAndUnit(transaction, dto.productId, dto.unitId);
      const batchId = await assertBatch(
        transaction,
        dto.productId,
        dto.batchId,
        product.trackBatches,
      );
      const quantityBase = damageQuantity(toBaseQuantity(enteredQuantity, unit.conversionFactor));
      const recorded = await this.ledger.recordMovement(transaction, {
        depotId: context.depotId,
        userId: principal.userId,
        productId: product.id,
        type: 'DAMAGE',
        quantity: quantityBase,
        reason: dto.reason,
        batchId,
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.STOCK_DAMAGE_RECORDED,
          entityType: 'StockMovement',
          entityId: recorded.movementId,
          after: {
            productId: product.id,
            unitId: unit.id,
            quantityBase: quantityBase.toString(),
            reason: dto.reason,
            batchId,
            stockAfter: recorded.stockAfter.toString(),
          },
        },
      });

      const view = toProductView(product, recorded.stockAfter);

      return {
        movementId: recorded.movementId,
        type: 'DAMAGE',
        quantity: quantityBase.toString(),
        quantityReadable: formatBaseQuantity(quantityBase, view.units),
        stockAfter: recorded.stockAfter.toString(),
        stockAfterReadable: view.currentStockReadable,
      };
    });
  }

  async batchAlerts(
    principal: AuthenticatedPrincipal,
    query: BatchAlertsQueryDto,
  ): Promise<BatchAlertsDto> {
    const context = TenantContext.fromPrincipal(principal);
    const today = new Date();
    const todayUtc = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    const threshold = new Date(todayUtc);
    threshold.setUTCDate(threshold.getUTCDate() + query.days);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const rows = await transaction.batch.findMany({
        where: { expiryDate: { not: null } },
        orderBy: { expiryDate: 'asc' },
        select: {
          id: true,
          productId: true,
          batchNumber: true,
          expiryDate: true,
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              productUnits: {
                select: {
                  name: true,
                  conversionFactor: true,
                  isBaseUnit: true,
                  isActive: true,
                },
              },
            },
          },
        },
      });
      const stock = await this.ledger.currentStockForBatches(
        transaction,
        rows.map((row) => row.id),
      );

      const alerts = rows
        .map((row) => this.toBatchAlert(row as AlertBatchRow, stock.get(row.id), todayUtc))
        .filter((row): row is NonNullable<typeof row> => row !== null);

      return {
        days: query.days,
        nearExpiry: alerts.filter((row) => row.daysToExpiry >= 0 && row.daysToExpiry <= query.days),
        expired: alerts.filter((row) => row.daysToExpiry < 0),
      };
    });
  }

  private async listWithContext(
    context: TenantContext,
    query: ListStockQueryDto,
  ): Promise<PaginatedStockDto> {
    const search = query.search?.trim();
    const where: Prisma.ProductWhereInput = {
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

    return this.prisma.runAsTenant(context, async (transaction) => {
      const products = await transaction.product.findMany({
        where,
        select: productSelect,
        orderBy: { name: 'asc' },
      });
      const stock = await this.ledger.currentStockForProducts(
        transaction,
        products.map((product) => product.id),
      );
      const trackedProductIds = products
        .filter((product) => product.trackBatches)
        .map((product) => product.id);
      const batches = await transaction.batch.findMany({
        where: { productId: { in: trackedProductIds } },
        orderBy: [{ expiryDate: 'asc' }, { batchNumber: 'asc' }],
        select: {
          id: true,
          productId: true,
          batchNumber: true,
          expiryDate: true,
        },
      });
      const batchStock = await this.ledger.currentStockForBatches(
        transaction,
        batches.map((batch) => batch.id),
      );
      const batchesByProduct = new Map<string, BatchRow[]>();

      for (const batch of batches) {
        const list = batchesByProduct.get(batch.productId) ?? [];
        list.push(batch);
        batchesByProduct.set(batch.productId, list);
      }

      let data = products.map((product) =>
        stockItem(
          product,
          stock.get(product.id) ?? new Prisma.Decimal(0),
          batchesByProduct.get(product.id) ?? [],
          batchStock,
        ),
      );

      if (query.lowStock === true) {
        data = data.filter((item) => item.lowStock);
      }

      data.sort((left, right) => {
        const comparison = compareStockItems(left, right, query.sort);
        return query.order === 'asc' ? comparison : -comparison;
      });

      const total = data.length;
      const skip = (query.page - 1) * query.pageSize;

      return {
        data: data.slice(skip, skip + query.pageSize),
        meta: { page: query.page, pageSize: query.pageSize, total },
      };
    });
  }

  private toMovementView(row: MovementRow): StockMovementDto {
    const units = row.product.productUnits.map((unit) => ({
      name: unit.name,
      conversionFactor: unit.conversionFactor,
      isBaseUnit: unit.isBaseUnit,
      isActive: unit.isActive,
    }));

    return {
      id: row.id,
      type: row.type,
      quantity: row.quantity.toString(),
      quantityReadable: formatBaseQuantity(row.quantity, units),
      unitCost: row.unitCost?.toFixed(2) ?? null,
      reason: row.reason,
      product: { id: row.product.id, sku: row.product.sku, name: row.product.name },
      batch: row.batch,
      createdBy: row.createdBy,
      saleOrderId: row.saleOrderId,
      purchaseOrderId: row.purchaseOrderId,
      createdAt: row.createdAt,
    };
  }

  private toBatchAlert(
    row: AlertBatchRow,
    currentStock: Prisma.Decimal | undefined,
    todayUtc: Date,
  ): {
    id: string;
    batchNumber: string;
    expiryDate: Date;
    daysToExpiry: number;
    productName: string;
    productSku: string;
    productId: string;
    currentStock: string;
    currentStockReadable: string;
  } | null {
    if (row.expiryDate === null || currentStock === undefined || currentStock.eq(0)) {
      return null;
    }

    const units = row.product.productUnits.map((unit) => ({
      name: unit.name,
      conversionFactor: unit.conversionFactor,
      isBaseUnit: unit.isBaseUnit,
      isActive: unit.isActive,
    }));

    return {
      id: row.id,
      batchNumber: row.batchNumber,
      expiryDate: row.expiryDate,
      daysToExpiry: Math.ceil(
        (row.expiryDate.getTime() - todayUtc.getTime()) / (24 * 60 * 60 * 1000),
      ),
      productName: row.product.name,
      productSku: row.product.sku,
      productId: row.product.id,
      currentStock: currentStock.toString(),
      currentStockReadable: formatBaseQuantity(currentStock, units),
    };
  }
}
