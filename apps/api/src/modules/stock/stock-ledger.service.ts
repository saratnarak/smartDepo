import { BadRequestException, Injectable } from '@nestjs/common';

import type { TenantScopedTransactionClient } from '../../common/tenant/tenant-scope.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { StockMovementType } from '../../generated/prisma/enums.js';
import { lockStockProduct } from '../../prisma/stock-locks.js';

export interface RecordStockMovementInput {
  depotId: string;
  userId: string;
  productId: string;
  type: StockMovementType;
  quantity: Prisma.Decimal;
  unitCost?: Prisma.Decimal | null;
  reason?: string | null;
  batchId?: string | null;
  saleOrderId?: string | null;
  purchaseOrderId?: string | null;
  allowNegativeStock?: boolean;
}

export interface RecordedStockMovement {
  movementId: string;
  stockAfter: Prisma.Decimal;
}

/**
 * Reusable stock ledger operations. Every stock-changing service (purchases now; sales later) calls
 * recordMovement inside its own transaction, so the movement, document, balance, and audit entry
 * commit or roll back together.
 */
@Injectable()
export class StockLedgerService {
  async currentStock(
    transaction: TenantScopedTransactionClient,
    productId: string,
  ): Promise<Prisma.Decimal> {
    const aggregate = await transaction.stockMovement.aggregate({
      where: { productId },
      _sum: { quantity: true },
    });

    return aggregate._sum.quantity ?? new Prisma.Decimal(0);
  }

  async currentStockForProducts(
    transaction: TenantScopedTransactionClient,
    productIds: readonly string[],
  ): Promise<Map<string, Prisma.Decimal>> {
    if (productIds.length === 0) {
      return new Map();
    }

    const rows = await transaction.stockMovement.groupBy({
      by: ['productId'],
      where: { productId: { in: [...productIds] } },
      _sum: { quantity: true },
    });

    return new Map(rows.map((row) => [row.productId, row._sum.quantity ?? new Prisma.Decimal(0)]));
  }

  async currentStockForBatches(
    transaction: TenantScopedTransactionClient,
    batchIds: readonly string[],
  ): Promise<Map<string, Prisma.Decimal>> {
    if (batchIds.length === 0) {
      return new Map();
    }

    const rows = await transaction.stockMovement.groupBy({
      by: ['batchId'],
      where: { batchId: { in: [...batchIds] } },
      _sum: { quantity: true },
    });

    return new Map(
      rows
        .filter((row): row is typeof row & { batchId: string } => row.batchId !== null)
        .map((row) => [row.batchId, row._sum.quantity ?? new Prisma.Decimal(0)]),
    );
  }

  /**
   * Records one signed movement after locking the depot+product. A negative movement is rejected
   * when it would take stock below zero, unless the depot explicitly allows negative stock.
   */
  async recordMovement(
    transaction: TenantScopedTransactionClient,
    input: RecordStockMovementInput,
  ): Promise<RecordedStockMovement> {
    await lockStockProduct(transaction, input.depotId, input.productId);

    if (input.quantity.eq(0)) {
      throw new BadRequestException('Stock movement quantity must not be zero');
    }

    const currentStock = await this.currentStock(transaction, input.productId);
    const stockAfter = currentStock.plus(input.quantity);

    if (input.quantity.lt(0)) {
      const allowNegativeStock =
        input.allowNegativeStock ??
        (await this.depotAllowsNegativeStock(transaction, input.depotId));

      if (!allowNegativeStock && stockAfter.lt(0)) {
        throw new BadRequestException(
          `Insufficient stock: available ${currentStock.toString()}, requested ${input.quantity.abs().toString()}`,
        );
      }

      if (input.batchId !== null && input.batchId !== undefined) {
        const batchStock = await this.currentStockForBatches(transaction, [input.batchId]);
        const available = batchStock.get(input.batchId) ?? new Prisma.Decimal(0);

        if (available.plus(input.quantity).lt(0)) {
          throw new BadRequestException(
            `Insufficient stock in the selected batch: available ${available.toString()}, requested ${input.quantity.abs().toString()}`,
          );
        }
      }
    }

    const movement = await transaction.stockMovement.create({
      data: {
        depotId: input.depotId,
        productId: input.productId,
        type: input.type,
        quantity: input.quantity,
        unitCost: input.unitCost ?? null,
        reason: input.reason ?? null,
        batchId: input.batchId ?? null,
        saleOrderId: input.saleOrderId ?? null,
        purchaseOrderId: input.purchaseOrderId ?? null,
        createdById: input.userId,
      },
      select: { id: true },
    });

    return { movementId: movement.id, stockAfter };
  }

  private async depotAllowsNegativeStock(
    transaction: TenantScopedTransactionClient,
    depotId: string,
  ): Promise<boolean> {
    const depot = await transaction.depot.findUnique({
      where: { id: depotId },
      select: { allowNegativeStock: true },
    });

    return depot?.allowNegativeStock ?? false;
  }
}
