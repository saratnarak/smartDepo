import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AUDIT_ACTIONS } from '../../common/audit/audit-actions.js';
import { calculateLineTotal, toBaseUnitCost, toMoney } from '../../common/money/money.js';
import { isUniqueConstraintError } from '../../common/prisma/prisma-errors.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { AuthenticatedPrincipal } from '../../common/tenant/tenant-context.js';
import type { TenantScopedTransactionClient } from '../../common/tenant/tenant-scope.js';
import { assertPositiveQuantity, toBaseQuantity } from '../../common/units/quantity.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { PurchaseOrderStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StockLedgerService } from '../stock/stock-ledger.service.js';
import type { CancelPurchaseDto } from './dto/cancel-purchase.dto.js';
import type { CreatePurchaseDto } from './dto/create-purchase.dto.js';
import type { ListPurchasesQueryDto } from './dto/list-purchases-query.dto.js';
import type { PurchaseLineDto } from './dto/purchase-line.dto.js';
import type { PaginatedPurchasesDto, PurchaseDto } from './dto/purchase.dto.js';
import type { UpdatePurchaseDto } from './dto/update-purchase.dto.js';

const purchaseSelect = {
  id: true,
  supplierId: true,
  referenceNumber: true,
  status: true,
  subtotal: true,
  discountTotal: true,
  total: true,
  orderedAt: true,
  receivedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  supplier: {
    select: { id: true, name: true, phone: true, email: true, address: true, isActive: true },
  },
  createdBy: { select: { id: true, name: true } },
  items: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      productId: true,
      productUnitId: true,
      quantity: true,
      quantityBase: true,
      unitCost: true,
      lineTotal: true,
      batchNumber: true,
      expiryDate: true,
      product: { select: { id: true, sku: true, name: true, trackBatches: true } },
      productUnit: { select: { id: true, name: true, conversionFactor: true } },
    },
  },
} as const;

type PurchaseRow = Prisma.PurchaseOrderGetPayload<{ select: typeof purchaseSelect }>;

interface ResolvedLine {
  productId: string;
  productUnitId: string;
  quantity: Prisma.Decimal;
  quantityBase: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  unitCostPerBaseUnit: Prisma.Decimal;
  batchNumber: string | null;
  expiryDate: Date | null;
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

function generateReferenceNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `PO-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function purchaseWhere(query: ListPurchasesQueryDto): Prisma.PurchaseOrderWhereInput {
  const search = query.search?.trim();
  const from = query.from === undefined ? undefined : new Date(query.from);
  const to = query.to === undefined ? undefined : new Date(query.to);

  return {
    ...(query.status === undefined ? {} : { status: query.status }),
    ...(query.supplierId === undefined ? {} : { supplierId: query.supplierId }),
    ...(search === undefined || search === ''
      ? {}
      : { referenceNumber: { contains: search, mode: 'insensitive' } }),
    ...(from === undefined && to === undefined
      ? {}
      : {
          createdAt: {
            ...(from === undefined ? {} : { gte: from }),
            ...(to === undefined ? {} : { lte: to }),
          },
        }),
  };
}

function purchaseAuditView(purchase: PurchaseDto) {
  return {
    id: purchase.id,
    referenceNumber: purchase.referenceNumber,
    status: purchase.status,
    supplierId: purchase.supplier.id,
    supplierName: purchase.supplier.name,
    subtotal: purchase.subtotal,
    discountTotal: purchase.discountTotal,
    total: purchase.total,
    notes: purchase.notes,
    receivedAt: purchase.receivedAt,
    items: purchase.items.map((item) => ({
      productId: item.productId,
      productUnitId: item.productUnitId,
      quantity: item.quantity,
      quantityBase: item.quantityBase,
      unitCost: item.unitCost,
      lineTotal: item.lineTotal,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate,
    })),
  };
}

function toPurchaseView(purchase: PurchaseRow): PurchaseDto {
  return {
    id: purchase.id,
    referenceNumber: purchase.referenceNumber,
    status: purchase.status as PurchaseOrderStatus,
    supplier: purchase.supplier,
    subtotal: purchase.subtotal.toFixed(2),
    discountTotal: purchase.discountTotal.toFixed(2),
    total: purchase.total.toFixed(2),
    orderedAt: purchase.orderedAt,
    receivedAt: purchase.receivedAt,
    notes: purchase.notes,
    createdBy: purchase.createdBy,
    items: purchase.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productSku: item.product.sku,
      productName: item.product.name,
      productUnitId: item.productUnitId,
      productUnitName: item.productUnit.name,
      quantity: item.quantity.toString(),
      quantityBase: item.quantityBase.toString(),
      unitCost: item.unitCost.toFixed(2),
      unitCostPerBaseUnit: toBaseUnitCost(item.unitCost, item.productUnit.conversionFactor).toFixed(
        2,
      ),
      lineTotal: item.lineTotal.toFixed(2),
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate,
    })),
    createdAt: purchase.createdAt,
    updatedAt: purchase.updatedAt,
  };
}

/**
 * Purchases (FR-37, FR-38). A draft is editable. Receiving claims the draft atomically, creates one
 * PURCHASE movement per line, saves batches, and updates the product's last cost per base unit in the
 * same transaction. Received purchases cannot be edited or cancelled; stock corrections use
 * adjustments.
 */
@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedgerService,
  ) {}

  async list(
    principal: AuthenticatedPrincipal,
    query: ListPurchasesQueryDto,
  ): Promise<PaginatedPurchasesDto> {
    const context = TenantContext.fromPrincipal(principal);
    const where = purchaseWhere(query);
    const skip = (query.page - 1) * query.pageSize;

    return this.prisma.runAsTenant(context, async (transaction) => {
      const [data, total] = await Promise.all([
        transaction.purchaseOrder.findMany({
          where,
          select: purchaseSelect,
          orderBy: { [query.sort]: query.order },
          skip,
          take: query.pageSize,
        }),
        transaction.purchaseOrder.count({ where }),
      ]);

      return {
        data: data.map(toPurchaseView),
        meta: { page: query.page, pageSize: query.pageSize, total },
      };
    });
  }

  async get(principal: AuthenticatedPrincipal, purchaseId: string): Promise<PurchaseDto> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const purchase = await transaction.purchaseOrder.findFirst({
        where: { id: purchaseId },
        select: purchaseSelect,
      });

      if (purchase === null) {
        throw new NotFoundException('Purchase not found');
      }

      return toPurchaseView(purchase);
    });
  }

  async create(principal: AuthenticatedPrincipal, dto: CreatePurchaseDto): Promise<PurchaseDto> {
    const context = TenantContext.fromPrincipal(principal);

    try {
      return await this.prisma.runAsTenant(context, async (transaction) => {
        await this.assertActiveSupplier(transaction, dto.supplierId);
        const lines = await this.resolveLines(transaction, dto.lines);
        const subtotal = lines.reduce(
          (total, line) => total.plus(line.lineTotal),
          new Prisma.Decimal(0),
        );
        const purchase = await transaction.purchaseOrder.create({
          data: {
            depotId: context.depotId,
            supplierId: dto.supplierId,
            referenceNumber: dto.referenceNumber ?? generateReferenceNumber(),
            status: 'DRAFT',
            subtotal: toMoney(subtotal),
            discountTotal: new Prisma.Decimal(0),
            total: toMoney(subtotal),
            notes: dto.notes ?? null,
            createdById: principal.userId,
            items: {
              create: lines.map((line) => ({
                depotId: context.depotId,
                productId: line.productId,
                productUnitId: line.productUnitId,
                quantity: line.quantity,
                quantityBase: line.quantityBase,
                unitCost: line.unitCost,
                lineTotal: line.lineTotal,
                batchNumber: line.batchNumber,
                expiryDate: line.expiryDate,
              })),
            },
          },
          select: purchaseSelect,
        });

        await transaction.auditLog.create({
          data: {
            actorUserId: principal.userId,
            action: AUDIT_ACTIONS.PURCHASE_CREATED,
            entityType: 'PurchaseOrder',
            entityId: purchase.id,
            after: purchaseAuditView(toPurchaseView(purchase)),
          },
        });

        return toPurchaseView(purchase);
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A purchase with this reference number already exists');
      }
      throw error;
    }
  }

  async update(
    principal: AuthenticatedPrincipal,
    purchaseId: string,
    dto: UpdatePurchaseDto,
  ): Promise<PurchaseDto> {
    if (dto.supplierId === undefined && dto.notes === undefined && dto.lines === undefined) {
      throw new BadRequestException('At least one field must be provided');
    }

    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const existing = await transaction.purchaseOrder.findFirst({
        where: { id: purchaseId },
        select: purchaseSelect,
      });

      if (existing === null) {
        throw new NotFoundException('Purchase not found');
      }
      if (existing.status !== 'DRAFT') {
        throw new BadRequestException('Only draft purchases can be edited');
      }

      const supplierId = dto.supplierId ?? existing.supplierId;
      if (dto.supplierId !== undefined) {
        await this.assertActiveSupplier(transaction, dto.supplierId);
      }

      const lines =
        dto.lines === undefined ? null : await this.resolveLines(transaction, dto.lines);
      const subtotal =
        lines === null
          ? existing.subtotal
          : lines.reduce((total, line) => total.plus(line.lineTotal), new Prisma.Decimal(0));

      const purchase = await transaction.purchaseOrder.update({
        where: { id: purchaseId },
        data: {
          supplierId,
          ...(dto.notes === undefined ? {} : { notes: dto.notes }),
          ...(lines === null
            ? {}
            : {
                subtotal: toMoney(subtotal),
                discountTotal: new Prisma.Decimal(0),
                total: toMoney(subtotal),
                items: {
                  deleteMany: {},
                  create: lines.map((line) => ({
                    depotId: context.depotId,
                    productId: line.productId,
                    productUnitId: line.productUnitId,
                    quantity: line.quantity,
                    quantityBase: line.quantityBase,
                    unitCost: line.unitCost,
                    lineTotal: line.lineTotal,
                    batchNumber: line.batchNumber,
                    expiryDate: line.expiryDate,
                  })),
                },
              }),
        },
        select: purchaseSelect,
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.PURCHASE_UPDATED,
          entityType: 'PurchaseOrder',
          entityId: purchase.id,
          before: purchaseAuditView(toPurchaseView(existing)),
          after: purchaseAuditView(toPurchaseView(purchase)),
        },
      });

      return toPurchaseView(purchase);
    });
  }

  async receive(principal: AuthenticatedPrincipal, purchaseId: string): Promise<PurchaseDto> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const existing = await transaction.purchaseOrder.findFirst({
        where: { id: purchaseId },
        select: purchaseSelect,
      });

      if (existing === null) {
        throw new NotFoundException('Purchase not found');
      }
      if (existing.status !== 'DRAFT') {
        throw new BadRequestException('Only draft purchases can be received');
      }

      const now = new Date();
      const claimed = await transaction.purchaseOrder.updateMany({
        where: { id: purchaseId, status: 'DRAFT' },
        data: {
          status: 'RECEIVED',
          receivedAt: now,
          orderedAt: existing.orderedAt ?? now,
        },
      });

      if (claimed.count === 0) {
        throw new BadRequestException('Purchase is no longer a draft');
      }

      for (const item of existing.items) {
        let batchId: string | null = null;

        if (item.product.trackBatches) {
          if (item.batchNumber === null || item.expiryDate === null) {
            throw new BadRequestException(
              `Batch number and expiry date are required for ${item.product.name}`,
            );
          }

          const batch = await transaction.batch.upsert({
            where: {
              productId_batchNumber: {
                productId: item.productId,
                batchNumber: item.batchNumber,
              },
            },
            create: {
              depotId: context.depotId,
              productId: item.productId,
              batchNumber: item.batchNumber,
              expiryDate: item.expiryDate,
              receivedAt: now,
            },
            update: {
              expiryDate: item.expiryDate,
              receivedAt: now,
            },
            select: { id: true },
          });

          batchId = batch.id;
        }

        const unitCostPerBaseUnit = toBaseUnitCost(
          item.unitCost,
          item.productUnit.conversionFactor,
        );

        await this.ledger.recordMovement(transaction, {
          depotId: context.depotId,
          userId: principal.userId,
          productId: item.productId,
          type: 'PURCHASE',
          quantity: item.quantityBase,
          unitCost: unitCostPerBaseUnit,
          reason: 'Purchase received',
          batchId,
          purchaseOrderId: purchaseId,
        });

        await transaction.product.update({
          where: { id: item.productId },
          data: { costPrice: unitCostPerBaseUnit },
        });
      }

      const purchase = await transaction.purchaseOrder.findFirst({
        where: { id: purchaseId },
        select: purchaseSelect,
      });

      if (purchase === null) {
        throw new NotFoundException('Purchase not found');
      }

      await transaction.auditLog.create({
        data: {
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.PURCHASE_RECEIVED,
          entityType: 'PurchaseOrder',
          entityId: purchase.id,
          after: purchaseAuditView(toPurchaseView(purchase)),
        },
      });

      return toPurchaseView(purchase);
    });
  }

  async cancel(
    principal: AuthenticatedPrincipal,
    purchaseId: string,
    dto: CancelPurchaseDto,
  ): Promise<PurchaseDto> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const existing = await transaction.purchaseOrder.findFirst({
        where: { id: purchaseId },
        select: purchaseSelect,
      });

      if (existing === null) {
        throw new NotFoundException('Purchase not found');
      }
      if (existing.status !== 'DRAFT') {
        throw new BadRequestException('Only draft purchases can be cancelled');
      }

      const cancelled = await transaction.purchaseOrder.updateMany({
        where: { id: purchaseId, status: 'DRAFT' },
        data: { status: 'CANCELLED' },
      });

      if (cancelled.count === 0) {
        throw new BadRequestException('Purchase is no longer a draft');
      }

      const purchase = await transaction.purchaseOrder.findFirst({
        where: { id: purchaseId },
        select: purchaseSelect,
      });

      if (purchase === null) {
        throw new NotFoundException('Purchase not found');
      }

      await transaction.auditLog.create({
        data: {
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.PURCHASE_CANCELLED,
          entityType: 'PurchaseOrder',
          entityId: purchase.id,
          before: purchaseAuditView(toPurchaseView(existing)),
          after: purchaseAuditView(toPurchaseView(purchase)),
          metadata: { reason: dto.reason ?? null },
        },
      });

      return toPurchaseView(purchase);
    });
  }

  private async assertActiveSupplier(
    transaction: TenantScopedTransactionClient,
    supplierId: string,
  ): Promise<void> {
    const supplier = await transaction.supplier.findFirst({
      where: { id: supplierId },
      select: { id: true, isActive: true },
    });

    if (supplier === null) {
      throw new NotFoundException('Supplier not found');
    }
    if (!supplier.isActive) {
      throw new BadRequestException('Archived suppliers cannot be used for new purchases');
    }
  }

  private async resolveLines(
    transaction: TenantScopedTransactionClient,
    lines: readonly PurchaseLineDto[],
  ): Promise<ResolvedLine[]> {
    const ids = [...new Set(lines.map((line) => line.productId))];
    const products = await transaction.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        sku: true,
        name: true,
        isActive: true,
        trackBatches: true,
        productUnits: {
          select: { id: true, name: true, conversionFactor: true, isActive: true },
        },
      },
    });
    const byId = new Map(products.map((product) => [product.id, product]));

    return lines.map((line) => {
      const product = byId.get(line.productId);

      if (product === undefined) {
        throw new NotFoundException('Product not found');
      }
      if (!product.isActive) {
        throw new BadRequestException('Archived products cannot be purchased');
      }

      const unit = product.productUnits.find((candidate) => candidate.id === line.unitId);

      if (unit === undefined) {
        throw new NotFoundException('Product unit not found');
      }
      if (!unit.isActive) {
        throw new BadRequestException('Archived product units cannot be used');
      }

      const quantity = decimalOrBadRequest(() => assertPositiveQuantity(line.quantity));
      const unitCost = toMoney(line.unitCost);
      const batchNumber = line.batchNumber?.trim() ?? null;
      const expiryDate =
        line.expiryDate === null || line.expiryDate === undefined
          ? null
          : new Date(line.expiryDate);

      if (expiryDate !== null && Number.isNaN(expiryDate.getTime())) {
        throw new BadRequestException('expiryDate must be a valid date');
      }
      if (product.trackBatches && (batchNumber === null || expiryDate === null)) {
        throw new BadRequestException(
          `Batch number and expiry date are required for ${product.name}`,
        );
      }

      return {
        productId: product.id,
        productUnitId: unit.id,
        quantity,
        quantityBase: toBaseQuantity(quantity, unit.conversionFactor),
        unitCost,
        lineTotal: calculateLineTotal(quantity, unitCost),
        unitCostPerBaseUnit: toBaseUnitCost(unitCost, unit.conversionFactor),
        batchNumber,
        expiryDate,
      };
    });
  }
}
