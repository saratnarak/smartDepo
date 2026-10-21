import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { AUDIT_ACTIONS } from '../../common/audit/audit-actions.js';
import { toMoney } from '../../common/money/money.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { AuthenticatedPrincipal } from '../../common/tenant/tenant-context.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { PaymentMethod } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { paymentStatusFor } from '../invoices/invoice-calculations.js';
import type { ListPaymentsQueryDto } from './dto/list-payments-query.dto.js';
import type { PaginatedPaymentsDto, PaymentDto } from './dto/payment.dto.js';
import type { RecordPaymentDto } from './dto/record-payment.dto.js';
import {
  AllocationError,
  allocateAcrossInvoices,
  validateAllocations,
  type OpenInvoice,
} from './payment-allocations.js';

const paymentSelect = {
  id: true,
  customerId: true,
  amount: true,
  method: true,
  reference: true,
  notes: true,
  paidAt: true,
  createdAt: true,
  customer: { select: { id: true, name: true } },
  receivedBy: { select: { id: true, name: true } },
  allocations: {
    select: {
      amount: true,
      salesOrder: { select: { id: true, invoiceNumber: true } },
    },
  },
} as const;

type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof paymentSelect }>;

function toView(payment: PaymentRow): PaymentDto {
  const allocated = payment.allocations.reduce(
    (sum, allocation) => sum.plus(allocation.amount),
    new Prisma.Decimal(0),
  );

  return {
    id: payment.id,
    customerId: payment.customerId,
    customerName: payment.customer.name,
    amount: payment.amount.toFixed(2),
    allocatedAmount: allocated.toFixed(2),
    unallocatedAmount: payment.amount.minus(allocated).toFixed(2),
    method: payment.method as PaymentMethod,
    reference: payment.reference,
    notes: payment.notes,
    paidAt: payment.paidAt,
    receivedBy: payment.receivedBy?.name ?? null,
    allocations: payment.allocations.map((allocation) => ({
      invoiceId: allocation.salesOrder.id,
      invoiceNumber: allocation.salesOrder.invoiceNumber,
      amount: allocation.amount.toFixed(2),
    })),
    createdAt: payment.createdAt,
  };
}

/**
 * Customer payments (FR-26, FR-35). A payment is written, allocated to invoices, and the payment
 * status of every touched invoice is updated in one transaction with an audit entry.
 */
@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(principal: AuthenticatedPrincipal, dto: RecordPaymentDto): Promise<PaymentDto> {
    const context = TenantContext.fromPrincipal(principal);
    const amount = toMoney(dto.amount);

    if (amount.lte(0)) {
      throw new BadRequestException('The payment must be greater than zero');
    }

    return this.prisma.runAsTenant(context, async (transaction) => {
      const customer = await transaction.customer.findFirst({
        where: { id: dto.customerId },
        select: { id: true, name: true, isActive: true },
      });

      if (customer === null) {
        throw new NotFoundException('Customer not found');
      }
      if (!customer.isActive) {
        throw new BadRequestException('Archived customers cannot receive payments');
      }

      const invoices = await transaction.salesOrder.findMany({
        where: { customerId: customer.id, status: 'COMPLETED' },
        orderBy: [{ orderDate: 'asc' }, { invoiceNumber: 'asc' }],
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          orderDate: true,
        },
      });
      const allocations = await transaction.paymentAllocation.groupBy({
        by: ['salesOrderId'],
        where: { salesOrderId: { in: invoices.map((invoice) => invoice.id) } },
        _sum: { amount: true },
      });
      const allocatedByInvoice = new Map<string, Prisma.Decimal>(
        allocations.map((row) => [row.salesOrderId, row._sum.amount ?? new Prisma.Decimal(0)]),
      );

      const openInvoices: OpenInvoice[] = invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
        allocated: allocatedByInvoice.get(invoice.id) ?? new Prisma.Decimal(0),
        orderDate: invoice.orderDate,
      }));
      const openById = new Map(openInvoices.map((invoice) => [invoice.id, invoice]));

      let applied: Array<{ invoiceId: string; amount: Prisma.Decimal }>;

      if (dto.allocations !== undefined && dto.allocations.length > 0) {
        const requested = dto.allocations.map((allocation) => ({
          invoiceId: allocation.invoiceId,
          amount: toMoney(allocation.amount),
        }));

        try {
          validateAllocations(amount, requested, openById);
        } catch (error) {
          if (error instanceof AllocationError) {
            throw new BadRequestException(error.message);
          }
          throw error;
        }

        applied = requested;
      } else {
        applied = allocateAcrossInvoices(amount, openInvoices);
      }

      const payment = await transaction.payment.create({
        data: {
          depotId: context.depotId,
          customerId: customer.id,
          amount,
          method: dto.method,
          reference: dto.reference ?? null,
          notes: dto.notes ?? null,
          paidAt: dto.paidAt === undefined ? new Date() : new Date(dto.paidAt),
          receivedById: principal.userId,
        },
        select: paymentSelect,
      });

      for (const allocation of applied) {
        await transaction.paymentAllocation.create({
          data: {
            depotId: context.depotId,
            paymentId: payment.id,
            salesOrderId: allocation.invoiceId,
            amount: allocation.amount,
          },
        });
      }

      for (const allocation of applied) {
        const invoice = openById.get(allocation.invoiceId);

        if (invoice === undefined) {
          continue;
        }

        const allocatedAfter = invoice.allocated.plus(allocation.amount);

        await transaction.salesOrder.update({
          where: { id: invoice.id },
          data: { paymentStatus: paymentStatusFor(invoice.total, allocatedAfter) },
        });
      }

      await transaction.auditLog.create({
        data: {
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.PAYMENT_RECORDED,
          entityType: 'Payment',
          entityId: payment.id,
          after: {
            customerId: customer.id,
            customerName: customer.name,
            amount: amount.toFixed(2),
            method: dto.method,
            allocations: applied.map((allocation) => ({
              invoiceId: allocation.invoiceId,
              amount: allocation.amount.toFixed(2),
            })),
            unallocated: amount
              .minus(applied.reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0)))
              .toFixed(2),
          },
        },
      });

      const saved = await transaction.payment.findFirst({
        where: { id: payment.id },
        select: paymentSelect,
      });

      return toView(saved ?? payment);
    });
  }

  async list(
    principal: AuthenticatedPrincipal,
    query: ListPaymentsQueryDto,
  ): Promise<PaginatedPaymentsDto> {
    const context = TenantContext.fromPrincipal(principal);
    const from = query.from === undefined ? undefined : new Date(query.from);
    const to = query.to === undefined ? undefined : new Date(query.to);
    const where: Prisma.PaymentWhereInput = {
      ...(query.customerId === undefined ? {} : { customerId: query.customerId }),
      ...(query.method === undefined ? {} : { method: query.method }),
      ...(from === undefined && to === undefined
        ? {}
        : {
            paidAt: {
              ...(from === undefined ? {} : { gte: from }),
              ...(to === undefined ? {} : { lte: to }),
            },
          }),
    };
    const skip = (query.page - 1) * query.pageSize;

    return this.prisma.runAsTenant(context, async (transaction) => {
      const [data, total] = await Promise.all([
        transaction.payment.findMany({
          where,
          select: paymentSelect,
          orderBy: { [query.sort]: query.order },
          skip,
          take: query.pageSize,
        }),
        transaction.payment.count({ where }),
      ]);

      return {
        data: data.map(toView),
        meta: { page: query.page, pageSize: query.pageSize, total },
      };
    });
  }

  async get(principal: AuthenticatedPrincipal, paymentId: string): Promise<PaymentDto> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const payment = await transaction.payment.findFirst({
        where: { id: paymentId },
        select: paymentSelect,
      });

      if (payment === null) {
        throw new NotFoundException('Payment not found');
      }

      return toView(payment);
    });
  }
}
