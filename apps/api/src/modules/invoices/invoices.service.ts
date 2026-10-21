import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AUDIT_ACTIONS } from '../../common/audit/audit-actions.js';
import { toMoney } from '../../common/money/money.js';
import { Permission, roleHasPermission } from '../../common/auth/permissions.js';
import { isUniqueConstraintError } from '../../common/prisma/prisma-errors.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { AuthenticatedPrincipal } from '../../common/tenant/tenant-context.js';
import type { TenantScopedTransactionClient } from '../../common/tenant/tenant-scope.js';
import {
  assertPositiveQuantity,
  formatBaseQuantity,
  toBaseQuantity,
} from '../../common/units/quantity.js';
import { Prisma } from '../../generated/prisma/client.js';
import type {
  DiscountType,
  PaymentStatus,
  PriceType,
  SalesOrderStatus,
} from '../../generated/prisma/enums.js';
import { lockInvoiceCounter } from '../../prisma/invoice-locks.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { outstandingBalances } from '../customers/customers.service.js';
import { StockLedgerService } from '../stock/stock-ledger.service.js';
import type { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import type {
  InvoiceBatchViewDto,
  InvoiceDto,
  InvoiceLineViewDto,
  InvoicePaymentViewDto,
  PaginatedInvoicesDto,
} from './dto/invoice.dto.js';
import type { ListInvoicesQueryDto } from './dto/list-invoices-query.dto.js';
import type { VoidInvoiceDto } from './dto/void-invoice.dto.js';
import {
  calculateInvoiceTotals,
  calculateLineTotals,
  outstandingFor,
  paymentStatusFor,
  type DiscountInput,
} from './invoice-calculations.js';

const invoiceSelect = {
  id: true,
  invoiceNumber: true,
  status: true,
  paymentStatus: true,
  customerId: true,
  subtotal: true,
  discountTotal: true,
  discountType: true,
  discountValue: true,
  total: true,
  refundDue: true,
  orderDate: true,
  dueDate: true,
  notes: true,
  voidReason: true,
  voidedAt: true,
  createdAt: true,
  customer: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  items: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      productId: true,
      productUnitId: true,
      quantity: true,
      quantityBase: true,
      unitPrice: true,
      discountAmount: true,
      discountType: true,
      discountValue: true,
      lineTotal: true,
      costPerBaseUnit: true,
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          trackBatches: true,
          productUnits: {
            select: {
              id: true,
              name: true,
              conversionFactor: true,
              isBaseUnit: true,
              isActive: true,
            },
          },
        },
      },
      productUnit: { select: { id: true, name: true, conversionFactor: true } },
      batches: {
        select: {
          quantity: true,
          batch: { select: { id: true, batchNumber: true, expiryDate: true } },
        },
      },
    },
  },
  paymentAllocations: {
    select: {
      amount: true,
      payment: {
        select: { id: true, amount: true, method: true, paidAt: true, reference: true },
      },
    },
  },
} as const;

type InvoiceRow = Prisma.SalesOrderGetPayload<{ select: typeof invoiceSelect }>;

interface ResolvedLine {
  productId: string;
  productName: string;
  productUnitId: string;
  productUnitName: string;
  quantity: Prisma.Decimal;
  quantityBase: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  costPerBaseUnit: Prisma.Decimal;
  trackBatches: boolean;
  discount: DiscountInput | null;
  gross: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  allocations: Array<{ batchId: string; quantity: Prisma.Decimal }>;
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

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function toView(invoice: InvoiceRow, creditLimitWarning: string | null = null): InvoiceDto {
  const allocated = invoice.paymentAllocations.reduce(
    (sum, allocation) => sum.plus(allocation.amount),
    new Prisma.Decimal(0),
  );
  const outstanding = outstandingFor(invoice.total, allocated);

  const items: InvoiceLineViewDto[] = invoice.items.map((item) => {
    const units = item.product.productUnits.map((unit) => ({
      name: unit.name,
      conversionFactor: unit.conversionFactor,
      isBaseUnit: unit.isBaseUnit,
      isActive: unit.isActive,
    }));

    const batches: InvoiceBatchViewDto[] = item.batches.map((entry) => ({
      id: entry.batch.id,
      batchNumber: entry.batch.batchNumber,
      expiryDate: entry.batch.expiryDate,
      quantity: entry.quantity.toString(),
    }));

    return {
      id: item.id,
      productId: item.productId,
      productSku: item.product.sku,
      productName: item.product.name,
      productUnitId: item.productUnitId,
      productUnitName: item.productUnit.name,
      quantity: item.quantity.toString(),
      quantityBase: item.quantityBase.toString(),
      quantityReadable: formatBaseQuantity(item.quantityBase, units),
      unitPrice: item.unitPrice.toFixed(2),
      discountAmount: item.discountAmount.toFixed(2),
      discountType: item.discountType as DiscountType | null,
      discountValue: item.discountValue?.toString() ?? null,
      lineTotal: item.lineTotal.toFixed(2),
      costPerBaseUnit: item.costPerBaseUnit?.toString() ?? null,
      batches,
    };
  });

  const payments: InvoicePaymentViewDto[] = invoice.paymentAllocations
    .map((allocation) => ({
      id: allocation.payment.id,
      amount: allocation.amount.toFixed(2),
      method: allocation.payment.method,
      paidAt: allocation.payment.paidAt,
      reference: allocation.payment.reference,
    }))
    .sort((left, right) => left.paidAt.getTime() - right.paidAt.getTime());

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status as SalesOrderStatus,
    paymentStatus: invoice.paymentStatus as PaymentStatus,
    customerId: invoice.customerId,
    customerName: invoice.customer.name,
    subtotal: invoice.subtotal.toFixed(2),
    discountTotal: invoice.discountTotal.toFixed(2),
    discountType: invoice.discountType as DiscountType | null,
    discountValue: invoice.discountValue?.toString() ?? null,
    total: invoice.total.toFixed(2),
    outstanding: outstanding.toFixed(2),
    paidAmount: allocated.toFixed(2),
    refundDue: invoice.refundDue.toFixed(2),
    orderDate: invoice.orderDate,
    dueDate: invoice.dueDate,
    notes: invoice.notes,
    voidReason: invoice.voidReason,
    voidedAt: invoice.voidedAt,
    createdBy: invoice.createdBy.name,
    items,
    payments,
    creditLimitWarning,
  };
}

/**
 * Invoices (FR-29, FR-30, FR-31, FR-32, FR-34). Creating an invoice is one transaction: the
 * invoice and its lines are written, the stock movements are recorded through the stock ledger,
 * a payment taken at the checkout is applied, and the audit entry is written. The server always
 * recalculates the prices and totals, so a client cannot change them.
 */
@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedgerService,
  ) {}

  async create(principal: AuthenticatedPrincipal, dto: CreateInvoiceDto): Promise<InvoiceDto> {
    const context = TenantContext.fromPrincipal(principal);
    const canOverridePrice = roleHasPermission(principal.role, Permission.INVOICES_PRICE_OVERRIDE);

    try {
      return await this.prisma.runAsTenant(context, async (transaction) => {
        if (dto.idempotencyKey !== undefined && dto.idempotencyKey !== null) {
          const existing = await transaction.salesOrder.findFirst({
            where: { idempotencyKey: dto.idempotencyKey },
            select: invoiceSelect,
          });

          if (existing !== null) {
            return toView(existing);
          }
        }

        const customer = await transaction.customer.findFirst({
          where: { id: dto.customerId },
          select: {
            id: true,
            name: true,
            type: true,
            creditLimit: true,
            paymentTermDays: true,
            isActive: true,
          },
        });

        if (customer === null) {
          throw new NotFoundException('Customer not found');
        }
        if (!customer.isActive) {
          throw new BadRequestException('Archived customers cannot be invoiced');
        }

        const priceType: PriceType = customer.type === 'RETAIL' ? 'RETAIL' : 'WHOLESALE';
        const lines = await this.resolveLines(transaction, dto, priceType, canOverridePrice);
        const totals = calculateInvoiceTotals(
          lines,
          dto.discount === undefined || dto.discount === null
            ? null
            : { type: dto.discount.type, value: dto.discount.value },
        );

        const creditLimitWarning = await this.checkCreditLimit(
          transaction,
          context.depotId,
          customer,
          totals.total,
        );

        await this.allocateBatches(transaction, lines);

        const invoiceNumber = await this.nextInvoiceNumber(transaction, context.depotId);
        const now = new Date();
        const dueDate = new Date(
          now.getTime() + (customer.paymentTermDays ?? 0) * 24 * 60 * 60 * 1000,
        );

        const invoice = await transaction.salesOrder.create({
          data: {
            depotId: context.depotId,
            customerId: customer.id,
            invoiceNumber,
            status: 'COMPLETED',
            paymentStatus: 'UNPAID',
            subtotal: totals.subtotal,
            discountTotal: totals.discountTotal,
            discountType: dto.discount?.type ?? null,
            discountValue:
              dto.discount === undefined || dto.discount === null
                ? null
                : new Prisma.Decimal(dto.discount.value),
            total: totals.total,
            orderDate: now,
            dueDate,
            notes: dto.notes ?? null,
            refundDue: new Prisma.Decimal(0),
            idempotencyKey: dto.idempotencyKey ?? null,
            createdById: principal.userId,
            completedAt: now,
            items: {
              create: lines.map((line) => ({
                depotId: context.depotId,
                productId: line.productId,
                productUnitId: line.productUnitId,
                quantity: line.quantity,
                quantityBase: line.quantityBase,
                unitPrice: line.unitPrice,
                discountAmount: line.discountAmount,
                discountType: line.discount?.type ?? null,
                discountValue:
                  line.discount === null ? null : new Prisma.Decimal(line.discount.value),
                lineTotal: line.lineTotal,
                costPerBaseUnit: line.costPerBaseUnit,
                batches: {
                  create: line.allocations.map((allocation) => ({
                    depotId: context.depotId,
                    batchId: allocation.batchId,
                    quantity: allocation.quantity,
                  })),
                },
              })),
            },
          },
          select: invoiceSelect,
        });

        for (const line of lines) {
          const movements =
            line.allocations.length === 0
              ? [{ batchId: null as string | null, quantity: line.quantityBase }]
              : line.allocations;

          for (const movement of movements) {
            await this.ledger.recordMovement(transaction, {
              depotId: context.depotId,
              userId: principal.userId,
              productId: line.productId,
              type: 'SALE',
              quantity: movement.quantity.negated(),
              unitCost: line.costPerBaseUnit,
              reason: `Invoice ${invoiceNumber}`,
              batchId: movement.batchId,
              saleOrderId: invoice.id,
            });
          }
        }

        let paymentStatus: PaymentStatus = 'UNPAID';

        if (dto.payment !== undefined && dto.payment !== null) {
          const amount = toMoney(dto.payment.amount);

          if (amount.gt(0)) {
            const payment = await transaction.payment.create({
              data: {
                depotId: context.depotId,
                customerId: customer.id,
                amount,
                method: dto.payment.method,
                reference: dto.payment.reference ?? null,
                paidAt: now,
                receivedById: principal.userId,
              },
            });

            const applied = amount.gt(totals.total) ? totals.total : amount;

            if (applied.gt(0)) {
              await transaction.paymentAllocation.create({
                data: {
                  depotId: context.depotId,
                  paymentId: payment.id,
                  salesOrderId: invoice.id,
                  amount: applied,
                },
              });
              paymentStatus = paymentStatusFor(totals.total, applied);
            }
          }
        }

        if (paymentStatus !== 'UNPAID') {
          await transaction.salesOrder.update({
            where: { id: invoice.id },
            data: { paymentStatus },
          });
        }

        await transaction.auditLog.create({
          data: {
            actorUserId: principal.userId,
            action: AUDIT_ACTIONS.INVOICE_CREATED,
            entityType: 'SalesOrder',
            entityId: invoice.id,
            after: {
              invoiceNumber,
              customerId: customer.id,
              customerName: customer.name,
              subtotal: totals.subtotal.toFixed(2),
              discountTotal: totals.discountTotal.toFixed(2),
              total: totals.total.toFixed(2),
              paymentStatus,
              lines: lines.map((line) => ({
                productId: line.productId,
                productUnitId: line.productUnitId,
                quantity: line.quantity.toString(),
                quantityBase: line.quantityBase.toString(),
                unitPrice: line.unitPrice.toFixed(2),
                lineTotal: line.lineTotal.toFixed(2),
              })),
            },
          },
        });

        const saved = await transaction.salesOrder.findFirst({
          where: { id: invoice.id },
          select: invoiceSelect,
        });

        return toView(saved ?? invoice, creditLimitWarning);
      });
    } catch (error) {
      if (
        isUniqueConstraintError(error) &&
        dto.idempotencyKey !== undefined &&
        dto.idempotencyKey !== null
      ) {
        return this.prisma.runAsTenant(context, async (transaction) => {
          const existing = await transaction.salesOrder.findFirst({
            where: { idempotencyKey: dto.idempotencyKey },
            select: invoiceSelect,
          });

          if (existing === null) {
            throw error;
          }

          return toView(existing);
        });
      }

      throw error;
    }
  }

  async list(
    principal: AuthenticatedPrincipal,
    query: ListInvoicesQueryDto,
  ): Promise<PaginatedInvoicesDto> {
    const context = TenantContext.fromPrincipal(principal);
    const search = query.search?.trim();
    const from = query.from === undefined ? undefined : new Date(query.from);
    const to = query.to === undefined ? undefined : new Date(query.to);
    const where: Prisma.SalesOrderWhereInput = {
      ...(query.customerId === undefined ? {} : { customerId: query.customerId }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.paymentStatus === undefined ? {} : { paymentStatus: query.paymentStatus }),
      ...(search === undefined || search === ''
        ? {}
        : { invoiceNumber: { contains: search, mode: 'insensitive' } }),
      ...(from === undefined && to === undefined
        ? {}
        : {
            orderDate: {
              ...(from === undefined ? {} : { gte: from }),
              ...(to === undefined ? {} : { lte: to }),
            },
          }),
    };
    const skip = (query.page - 1) * query.pageSize;

    return this.prisma.runAsTenant(context, async (transaction) => {
      const [data, total] = await Promise.all([
        transaction.salesOrder.findMany({
          where,
          select: invoiceSelect,
          orderBy: { [query.sort]: query.order },
          skip,
          take: query.pageSize,
        }),
        transaction.salesOrder.count({ where }),
      ]);

      return {
        data: data.map((invoice) => toView(invoice)),
        meta: { page: query.page, pageSize: query.pageSize, total },
      };
    });
  }

  async get(principal: AuthenticatedPrincipal, invoiceId: string): Promise<InvoiceDto> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const invoice = await transaction.salesOrder.findFirst({
        where: { id: invoiceId },
        select: invoiceSelect,
      });

      if (invoice === null) {
        throw new NotFoundException('Invoice not found');
      }

      return toView(invoice);
    });
  }

  /**
   * Everything needed to print an invoice (FR-33). The PDF and the thermal receipt are built from
   * this document in a later task.
   */
  async document(principal: AuthenticatedPrincipal, invoiceId: string) {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const invoice = await transaction.salesOrder.findFirst({
        where: { id: invoiceId },
        select: invoiceSelect,
      });

      if (invoice === null) {
        throw new NotFoundException('Invoice not found');
      }

      const depot = await transaction.depot.findUnique({
        where: { id: context.depotId },
        select: {
          name: true,
          address: true,
          phone: true,
          currency: true,
          logoKey: true,
          invoiceFooter: true,
        },
      });

      const customer = await transaction.customer.findFirst({
        where: { id: invoice.customerId },
        select: { id: true, name: true, phone: true, address: true },
      });

      if (depot === null || customer === null) {
        throw new NotFoundException('Invoice not found');
      }

      const view = toView(invoice);

      return {
        invoiceNumber: invoice.invoiceNumber,
        orderDate: invoice.orderDate,
        dueDate: invoice.dueDate,
        paymentStatus: view.paymentStatus,
        depot: {
          name: depot.name,
          address: depot.address,
          phone: depot.phone,
          currency: depot.currency,
          logoKey: depot.logoKey,
          invoiceFooter: depot.invoiceFooter,
        },
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
        },
        items: view.items,
        subtotal: view.subtotal,
        discountTotal: view.discountTotal,
        total: view.total,
        outstanding: view.outstanding,
        payments: view.payments,
        notes: invoice.notes,
      };
    });
  }

  /**
   * Void an invoice (FR-34). Only the owner may do this. The stock comes back with RETURN
   * movements, the unpaid part leaves the customer balance because a voided invoice is not
   * counted, and money that was already paid is reported as a refund due.
   */
  async void(
    principal: AuthenticatedPrincipal,
    invoiceId: string,
    dto: VoidInvoiceDto,
  ): Promise<InvoiceDto> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const invoice = await transaction.salesOrder.findFirst({
        where: { id: invoiceId },
        select: invoiceSelect,
      });

      if (invoice === null) {
        throw new NotFoundException('Invoice not found');
      }
      if (invoice.status === 'VOIDED') {
        throw new BadRequestException('The invoice is already voided');
      }

      for (const item of invoice.items) {
        const movements =
          item.batches.length === 0
            ? [{ batchId: null as string | null, quantity: item.quantityBase }]
            : item.batches.map((entry) => ({
                batchId: entry.batch.id,
                quantity: entry.quantity,
              }));

        for (const movement of movements) {
          await this.ledger.recordMovement(transaction, {
            depotId: context.depotId,
            userId: principal.userId,
            productId: item.productId,
            type: 'RETURN',
            quantity: movement.quantity,
            unitCost: item.costPerBaseUnit,
            reason: `Invoice ${invoice.invoiceNumber} voided: ${dto.reason}`,
            batchId: movement.batchId,
            saleOrderId: invoice.id,
          });
        }
      }

      const allocated = invoice.paymentAllocations.reduce(
        (sum, allocation) => sum.plus(allocation.amount),
        new Prisma.Decimal(0),
      );

      const voided = await transaction.salesOrder.update({
        where: { id: invoice.id },
        data: {
          status: 'VOIDED',
          voidedAt: new Date(),
          voidReason: dto.reason,
          refundDue: allocated,
        },
        select: invoiceSelect,
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.INVOICE_VOIDED,
          entityType: 'SalesOrder',
          entityId: invoice.id,
          before: {
            status: invoice.status,
            paymentStatus: invoice.paymentStatus,
            total: invoice.total.toFixed(2),
          },
          after: {
            status: voided.status,
            refundDue: allocated.toFixed(2),
            reason: dto.reason,
          },
        },
      });

      return toView(voided);
    });
  }

  /** The invoice lines with their prices, totals, and batch allocation. */
  private async resolveLines(
    transaction: TenantScopedTransactionClient,
    dto: CreateInvoiceDto,
    priceType: PriceType,
    canOverridePrice: boolean,
  ): Promise<ResolvedLine[]> {
    const productIds = [...new Set(dto.lines.map((line) => line.productId))];
    const products = await transaction.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        sku: true,
        name: true,
        isActive: true,
        trackBatches: true,
        costPrice: true,
        productUnits: {
          select: {
            id: true,
            name: true,
            conversionFactor: true,
            isBaseUnit: true,
            isActive: true,
            prices: {
              where: { type: priceType },
              select: { id: true, amount: true },
            },
          },
        },
      },
    });
    const byId = new Map(products.map((product) => [product.id, product]));

    return dto.lines.map((line) => {
      const product = byId.get(line.productId);

      if (product === undefined) {
        throw new NotFoundException('Product not found');
      }
      if (!product.isActive) {
        throw new BadRequestException('Archived products cannot be sold');
      }

      const unit = product.productUnits.find((candidate) => candidate.id === line.unitId);

      if (unit === undefined) {
        throw new NotFoundException('Product unit not found');
      }
      if (!unit.isActive) {
        throw new BadRequestException('Archived product units cannot be sold');
      }

      const quantity = decimalOrBadRequest(() => assertPositiveQuantity(line.quantity));
      const quantityBase = toBaseQuantity(quantity, unit.conversionFactor);

      let unitPrice: Prisma.Decimal;

      if (line.unitPrice !== undefined && line.unitPrice !== null) {
        if (!canOverridePrice) {
          throw new ForbiddenException('Only the depot owner can override a price');
        }

        unitPrice = toMoney(line.unitPrice);
      } else {
        const price = unit.prices[0];

        if (price === undefined) {
          throw new BadRequestException(
            `No ${priceType.toLowerCase()} price is set for ${product.name} (${unit.name})`,
          );
        }

        unitPrice = price.amount;
      }

      const discount: DiscountInput | null =
        line.discount === undefined || line.discount === null
          ? null
          : { type: line.discount.type, value: line.discount.value };

      const totals = calculateLineTotals({ quantity, unitPrice, discount });

      return {
        productId: product.id,
        productName: product.name,
        productUnitId: unit.id,
        productUnitName: unit.name,
        quantity,
        quantityBase,
        unitPrice,
        costPerBaseUnit: product.costPrice,
        trackBatches: product.trackBatches,
        discount,
        gross: totals.gross,
        discountAmount: totals.discountAmount,
        lineTotal: totals.lineTotal,
        allocations: [],
      };
    });
  }

  /**
   * First expiry first out (FR-22 for the sale side). The quantity of a batch-tracked product is
   * taken from the batches with the earliest expiry date. Expired batches are never used, and the
   * invoice fails with a clear message when the usable batches do not hold enough stock.
   */
  private async allocateBatches(
    transaction: TenantScopedTransactionClient,
    lines: ResolvedLine[],
  ): Promise<void> {
    const tracked = lines.filter((line) => line.trackBatches);

    if (tracked.length === 0) {
      return;
    }

    const today = startOfUtcDay(new Date());
    const batches = await transaction.batch.findMany({
      where: {
        productId: { in: [...new Set(tracked.map((line) => line.productId))] },
        OR: [{ expiryDate: null }, { expiryDate: { gte: today } }],
      },
      select: { id: true, productId: true, batchNumber: true, expiryDate: true },
      orderBy: [{ expiryDate: 'asc' }, { batchNumber: 'asc' }],
    });

    const stock = await this.ledger.currentStockForBatches(
      transaction,
      batches.map((batch) => batch.id),
    );

    for (const line of tracked) {
      let remaining = line.quantityBase;
      const allocations: Array<{ batchId: string; quantity: Prisma.Decimal }> = [];

      for (const batch of batches.filter((candidate) => candidate.productId === line.productId)) {
        if (remaining.lte(0)) {
          break;
        }

        const available = stock.get(batch.id) ?? new Prisma.Decimal(0);

        if (available.lte(0)) {
          continue;
        }

        const take = available.lt(remaining) ? available : remaining;
        allocations.push({ batchId: batch.id, quantity: take });
        stock.set(batch.id, available.minus(take));
        remaining = remaining.minus(take);
      }

      if (remaining.gt(0)) {
        const available = line.quantityBase.minus(remaining);
        throw new BadRequestException(
          `Not enough usable stock in the batches of ${line.productName}: needed ${line.quantityBase.toString()}, available ${available.toString()}`,
        );
      }

      line.allocations = allocations;
    }
  }

  /** The credit limit of the customer, depending on the depot setting. */
  private async checkCreditLimit(
    transaction: TenantScopedTransactionClient,
    depotId: string,
    customer: { id: string; name: string; creditLimit: Prisma.Decimal | null },
    invoiceTotal: Prisma.Decimal,
  ): Promise<string | null> {
    if (customer.creditLimit === null) {
      return null;
    }

    const balances = await outstandingBalances(transaction, [customer.id]);
    const current = balances.get(customer.id) ?? new Prisma.Decimal(0);
    const after = current.plus(invoiceTotal);

    if (after.lte(customer.creditLimit)) {
      return null;
    }

    const depot = await transaction.depot.findUnique({
      where: { id: depotId },
      select: { creditLimitMode: true },
    });

    if (depot?.creditLimitMode === 'BLOCK') {
      throw new BadRequestException(
        `This invoice would push ${customer.name} past their credit limit of ${customer.creditLimit.toFixed(2)}. The customer already owes ${current.toFixed(2)}.`,
      );
    }

    return `The customer would be ${after.toFixed(2)} over their credit limit of ${customer.creditLimit.toFixed(2)}.`;
  }

  /** The next invoice number of the depot, safe under concurrent requests. */
  private async nextInvoiceNumber(
    transaction: TenantScopedTransactionClient,
    depotId: string,
  ): Promise<string> {
    await lockInvoiceCounter(transaction, depotId);

    const last = await transaction.salesOrder.findFirst({
      where: {},
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    const next =
      last === null ? 1 : Number.parseInt(last.invoiceNumber.replace(/^INV-/, ''), 10) + 1;

    return `INV-${String(Number.isFinite(next) ? next : 1).padStart(6, '0')}`;
  }
}
