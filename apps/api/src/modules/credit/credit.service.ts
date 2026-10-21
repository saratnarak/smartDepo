import { Injectable } from '@nestjs/common';

import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { AuthenticatedPrincipal } from '../../common/tenant/tenant-context.js';
import type { TenantScopedTransactionClient } from '../../common/tenant/tenant-scope.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { outstandingFor } from '../invoices/invoice-calculations.js';
import { buildAgeingBuckets, bucketFor, daysOverdue } from './credit-calculations.js';
import type {
  AgeingBucketDto,
  CreditOverviewDto,
  OverdueInvoiceDto,
  PaginatedOverdueDto,
} from './dto/credit.dto.js';

interface OpenInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  total: Prisma.Decimal;
  allocated: Prisma.Decimal;
  orderDate: Date;
  dueDate: Date | null;
}

async function loadOpenInvoices(
  transaction: TenantScopedTransactionClient,
  customerId?: string,
): Promise<OpenInvoice[]> {
  const invoices = await transaction.salesOrder.findMany({
    where: {
      status: 'COMPLETED',
      ...(customerId === undefined ? {} : { customerId }),
    },
    orderBy: [{ orderDate: 'asc' }, { invoiceNumber: 'asc' }],
    select: {
      id: true,
      invoiceNumber: true,
      customerId: true,
      total: true,
      orderDate: true,
      dueDate: true,
      customer: { select: { name: true } },
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

  return invoices.map((invoice) => ({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerId: invoice.customerId,
    customerName: invoice.customer.name,
    total: invoice.total,
    allocated: allocatedByInvoice.get(invoice.id) ?? new Prisma.Decimal(0),
    orderDate: invoice.orderDate,
    dueDate: invoice.dueDate,
  }));
}

/**
 * Credit views (FR-27, FR-28). The overdue list and the ageing buckets are derived from the
 * invoices and the payments, never from a stored balance.
 */
@Injectable()
export class CreditService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(principal: AuthenticatedPrincipal): Promise<CreditOverviewDto> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const invoices = await loadOpenInvoices(transaction);
      const today = new Date();

      const open = invoices
        .map((invoice) => ({
          invoice,
          outstanding: outstandingFor(invoice.total, invoice.allocated),
          days: daysOverdue(invoice.dueDate, today),
        }))
        .filter((entry) => entry.outstanding.gt(0));

      const totalOutstanding = open.reduce(
        (sum, entry) => sum.plus(entry.outstanding),
        new Prisma.Decimal(0),
      );
      const overdue = open.filter((entry) => entry.days > 0);
      const totalOverdue = overdue.reduce(
        (sum, entry) => sum.plus(entry.outstanding),
        new Prisma.Decimal(0),
      );

      const refunds = await transaction.salesOrder.aggregate({
        where: { status: 'VOIDED' },
        _sum: { refundDue: true },
      });

      const ageing: AgeingBucketDto[] = buildAgeingBuckets(
        open.map((entry) => ({ daysOverdue: entry.days, outstanding: entry.outstanding })),
      );

      return {
        totalOutstanding: totalOutstanding.toFixed(2),
        totalOverdue: totalOverdue.toFixed(2),
        openInvoiceCount: open.length,
        overdueInvoiceCount: overdue.length,
        totalRefundDue: (refunds._sum.refundDue ?? new Prisma.Decimal(0)).toFixed(2),
        ageing,
      };
    });
  }

  async overdue(
    principal: AuthenticatedPrincipal,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedOverdueDto> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const invoices = await loadOpenInvoices(transaction);
      const today = new Date();

      const overdue: OverdueInvoiceDto[] = invoices
        .map((invoice) => {
          const outstanding = outstandingFor(invoice.total, invoice.allocated);
          const days = daysOverdue(invoice.dueDate, today);

          return { invoice, outstanding, days };
        })
        .filter((entry) => entry.days > 0 && entry.outstanding.gt(0))
        .sort((left, right) => left.days - right.days)
        .map((entry) => ({
          id: entry.invoice.id,
          invoiceNumber: entry.invoice.invoiceNumber,
          customerId: entry.invoice.customerId,
          customerName: entry.invoice.customerName,
          total: entry.invoice.total.toFixed(2),
          outstanding: entry.outstanding.toFixed(2),
          orderDate: entry.invoice.orderDate,
          dueDate: entry.invoice.dueDate,
          daysOverdue: entry.days,
          ageingBucket: bucketFor(entry.days),
        }));

      const skip = (page - 1) * pageSize;

      return {
        data: overdue.slice(skip, skip + pageSize),
        meta: { page, pageSize, total: overdue.length },
      };
    });
  }

  async ageing(principal: AuthenticatedPrincipal): Promise<{ ageing: AgeingBucketDto[] }> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const invoices = await loadOpenInvoices(transaction);
      const today = new Date();

      const open = invoices
        .map((invoice) => ({
          outstanding: outstandingFor(invoice.total, invoice.allocated),
          days: daysOverdue(invoice.dueDate, today),
        }))
        .filter((entry) => entry.outstanding.gt(0));

      return {
        ageing: buildAgeingBuckets(
          open.map((entry) => ({ daysOverdue: entry.days, outstanding: entry.outstanding })),
        ),
      };
    });
  }
}
