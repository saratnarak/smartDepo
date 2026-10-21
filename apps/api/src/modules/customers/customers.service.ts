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
import { Prisma } from '../../generated/prisma/client.js';
import type { CustomerType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateCustomerDto } from './dto/create-customer.dto.js';
import type {
  CustomerDto,
  CustomerStatementDto,
  CustomerStatementLineDto,
  PaginatedCustomersDto,
} from './dto/customer.dto.js';
import type { ListCustomersQueryDto } from './dto/list-customers-query.dto.js';
import type { UpdateCustomerDto } from './dto/update-customer.dto.js';

const customerSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  type: true,
  creditLimit: true,
  paymentTermDays: true,
  notes: true,
  isActive: true,
  isWalkIn: true,
  createdAt: true,
  updatedAt: true,
} as const;

type CustomerRow = Prisma.CustomerGetPayload<{ select: typeof customerSelect }>;

const WALK_IN_NAME = 'Walk-in';

function toView(customer: CustomerRow, balance: Prisma.Decimal): CustomerDto {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    type: customer.type as CustomerType,
    creditLimit: customer.creditLimit?.toFixed(2) ?? null,
    paymentTermDays: customer.paymentTermDays,
    notes: customer.notes,
    isActive: customer.isActive,
    isWalkIn: customer.isWalkIn,
    balance: balance.toFixed(2),
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

/** The plain object that goes into the audit log. */
function customerAuditView(customer: CustomerRow): Prisma.InputJsonObject {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    type: customer.type,
    creditLimit: customer.creditLimit?.toFixed(2) ?? null,
    paymentTermDays: customer.paymentTermDays,
    notes: customer.notes,
    isActive: customer.isActive,
    isWalkIn: customer.isWalkIn,
  };
}

/**
 * Outstanding balance per customer, derived from the invoices and the payment allocations.
 * Nothing is typed in by hand, so the balance can never drift from the documents.
 */
export async function outstandingBalances(
  transaction: TenantScopedTransactionClient,
  customerIds?: readonly string[],
): Promise<Map<string, Prisma.Decimal>> {
  const invoices = await transaction.salesOrder.findMany({
    where: {
      status: 'COMPLETED',
      ...(customerIds === undefined ? {} : { customerId: { in: [...customerIds] } }),
    },
    select: { id: true, customerId: true, total: true },
  });

  const balances = new Map<string, Prisma.Decimal>();

  for (const invoice of invoices) {
    const current = balances.get(invoice.customerId) ?? new Prisma.Decimal(0);
    balances.set(invoice.customerId, current.plus(invoice.total));
  }

  if (invoices.length === 0) {
    return balances;
  }

  const allocations = await transaction.paymentAllocation.groupBy({
    by: ['salesOrderId'],
    where: { salesOrderId: { in: invoices.map((invoice) => invoice.id) } },
    _sum: { amount: true },
  });

  const allocatedByInvoice = new Map<string, Prisma.Decimal>(
    allocations.map((row) => [row.salesOrderId, row._sum.amount ?? new Prisma.Decimal(0)]),
  );

  for (const invoice of invoices) {
    const allocated = allocatedByInvoice.get(invoice.id) ?? new Prisma.Decimal(0);
    const current = balances.get(invoice.customerId) ?? new Prisma.Decimal(0);
    balances.set(invoice.customerId, current.minus(allocated));
  }

  return balances;
}

/** Makes sure every depot has its default cash customer. */
export async function ensureWalkInCustomer(
  transaction: TenantScopedTransactionClient,
  depotId: string,
): Promise<CustomerRow> {
  const existing = await transaction.customer.findFirst({
    where: { isWalkIn: true },
    select: customerSelect,
  });

  if (existing !== null) {
    return existing;
  }

  // createMany with skipDuplicates keeps two parallel requests from failing on the one-walk-in
  // per depot index.
  await transaction.customer.createMany({
    data: [
      {
        depotId,
        name: WALK_IN_NAME,
        type: 'RETAIL',
        isActive: true,
        isWalkIn: true,
        notes: 'Default cash customer',
      },
    ],
    skipDuplicates: true,
  });

  const created = await transaction.customer.findFirst({
    where: { isWalkIn: true },
    select: customerSelect,
  });

  if (created === null) {
    throw new Error('The walk-in customer could not be created');
  }

  return created;
}

/**
 * Customers and credit (FR-23, FR-24). The owner and the sales staff share the customer list;
 * the stock keeper has no access. Every customer read and write is scoped to the depot of the
 * access token.
 */
@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    principal: AuthenticatedPrincipal,
    query: ListCustomersQueryDto,
  ): Promise<PaginatedCustomersDto> {
    const context = TenantContext.fromPrincipal(principal);
    const search = query.search?.trim();
    const where: Prisma.CustomerWhereInput = {
      ...(query.type === undefined ? {} : { type: query.type }),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(search === undefined || search === ''
        ? {}
        : {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }),
    };
    const skip = (query.page - 1) * query.pageSize;

    return this.prisma.runAsTenant(context, async (transaction) => {
      await ensureWalkInCustomer(transaction, context.depotId);

      const [data, total] = await Promise.all([
        transaction.customer.findMany({
          where,
          select: customerSelect,
          orderBy: { [query.sort]: query.order },
          skip,
          take: query.pageSize,
        }),
        transaction.customer.count({ where }),
      ]);

      const balances = await outstandingBalances(
        transaction,
        data.map((customer) => customer.id),
      );

      return {
        data: data.map((customer) =>
          toView(customer, balances.get(customer.id) ?? new Prisma.Decimal(0)),
        ),
        meta: { page: query.page, pageSize: query.pageSize, total },
      };
    });
  }

  async get(principal: AuthenticatedPrincipal, customerId: string): Promise<CustomerDto> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const customer = await transaction.customer.findFirst({
        where: { id: customerId },
        select: customerSelect,
      });

      if (customer === null) {
        throw new NotFoundException('Customer not found');
      }

      const balances = await outstandingBalances(transaction, [customer.id]);

      return toView(customer, balances.get(customer.id) ?? new Prisma.Decimal(0));
    });
  }

  async create(principal: AuthenticatedPrincipal, dto: CreateCustomerDto): Promise<CustomerDto> {
    const context = TenantContext.fromPrincipal(principal);

    try {
      return await this.prisma.runAsTenant(context, async (transaction) => {
        const customer = await transaction.customer.create({
          data: {
            depotId: context.depotId,
            name: dto.name,
            phone: dto.phone ?? null,
            email: dto.email ?? null,
            address: dto.address ?? null,
            type: dto.type ?? 'RETAIL',
            creditLimit:
              dto.creditLimit === undefined || dto.creditLimit === null
                ? null
                : new Prisma.Decimal(dto.creditLimit),
            paymentTermDays: dto.paymentTermDays ?? null,
            notes: dto.notes ?? null,
            isActive: true,
            isWalkIn: false,
          },
          select: customerSelect,
        });

        await transaction.auditLog.create({
          data: {
            actorUserId: principal.userId,
            action: AUDIT_ACTIONS.CUSTOMER_CREATED,
            entityType: 'Customer',
            entityId: customer.id,
            after: customerAuditView(customer),
          },
        });

        return toView(customer, new Prisma.Decimal(0));
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('This depot already has a customer with that name');
      }
      throw error;
    }
  }

  async update(
    principal: AuthenticatedPrincipal,
    customerId: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerDto> {
    if (
      dto.name === undefined &&
      dto.phone === undefined &&
      dto.email === undefined &&
      dto.address === undefined &&
      dto.type === undefined &&
      dto.creditLimit === undefined &&
      dto.paymentTermDays === undefined &&
      dto.notes === undefined
    ) {
      throw new BadRequestException('At least one field must be provided');
    }

    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const existing = await transaction.customer.findFirst({
        where: { id: customerId },
        select: customerSelect,
      });

      if (existing === null) {
        throw new NotFoundException('Customer not found');
      }

      if (existing.isWalkIn) {
        throw new BadRequestException('The walk-in customer cannot be archived');
      }

      const customer = await transaction.customer.update({
        where: { id: customerId },
        data: {
          ...(dto.name === undefined ? {} : { name: dto.name }),
          ...(dto.phone === undefined ? {} : { phone: dto.phone }),
          ...(dto.email === undefined ? {} : { email: dto.email }),
          ...(dto.address === undefined ? {} : { address: dto.address }),
          ...(dto.type === undefined ? {} : { type: dto.type }),
          ...(dto.creditLimit === undefined
            ? {}
            : {
                creditLimit: dto.creditLimit === null ? null : new Prisma.Decimal(dto.creditLimit),
              }),
          ...(dto.paymentTermDays === undefined ? {} : { paymentTermDays: dto.paymentTermDays }),
          ...(dto.notes === undefined ? {} : { notes: dto.notes }),
        },
        select: customerSelect,
      });

      const balances = await outstandingBalances(transaction, [customer.id]);
      const view = toView(customer, balances.get(customer.id) ?? new Prisma.Decimal(0));

      await transaction.auditLog.create({
        data: {
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.CUSTOMER_UPDATED,
          entityType: 'Customer',
          entityId: customer.id,
          before: customerAuditView(existing),
          after: customerAuditView(customer),
        },
      });

      return view;
    });
  }

  async archive(principal: AuthenticatedPrincipal, customerId: string): Promise<CustomerDto> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const existing = await transaction.customer.findFirst({
        where: { id: customerId },
        select: customerSelect,
      });

      if (existing === null) {
        throw new NotFoundException('Customer not found');
      }

      if (existing.isWalkIn) {
        throw new BadRequestException('The walk-in customer cannot be archived');
      }

      if (!existing.isActive) {
        return toView(existing, new Prisma.Decimal(0));
      }

      const customer = await transaction.customer.update({
        where: { id: customerId },
        data: { isActive: false },
        select: customerSelect,
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: principal.userId,
          action: AUDIT_ACTIONS.CUSTOMER_ARCHIVED,
          entityType: 'Customer',
          entityId: customer.id,
          before: customerAuditView(existing),
          after: customerAuditView(customer),
        },
      });

      return toView(customer, new Prisma.Decimal(0));
    });
  }

  /**
   * Customer statement (FR-28): every invoice and payment of the customer with a running balance.
   */
  async statement(
    principal: AuthenticatedPrincipal,
    customerId: string,
  ): Promise<CustomerStatementDto> {
    const context = TenantContext.fromPrincipal(principal);

    return this.prisma.runAsTenant(context, async (transaction) => {
      const customer = await transaction.customer.findFirst({
        where: { id: customerId },
        select: customerSelect,
      });

      if (customer === null) {
        throw new NotFoundException('Customer not found');
      }

      const [invoices, payments] = await Promise.all([
        transaction.salesOrder.findMany({
          where: { customerId, status: { not: 'VOIDED' } },
          orderBy: [{ orderDate: 'asc' }, { invoiceNumber: 'asc' }],
          select: {
            id: true,
            invoiceNumber: true,
            orderDate: true,
            total: true,
            paymentStatus: true,
          },
        }),
        transaction.payment.findMany({
          where: { customerId },
          orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            amount: true,
            method: true,
            paidAt: true,
            reference: true,
          },
        }),
      ]);

      const entries: Array<{
        date: Date;
        type: 'INVOICE' | 'PAYMENT';
        reference: string;
        description: string;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
      }> = [];

      for (const invoice of invoices) {
        entries.push({
          date: invoice.orderDate,
          type: 'INVOICE',
          reference: invoice.invoiceNumber,
          description: 'Invoice',
          debit: invoice.total,
          credit: new Prisma.Decimal(0),
        });
      }

      for (const payment of payments) {
        entries.push({
          date: payment.paidAt,
          type: 'PAYMENT',
          reference: payment.reference ?? payment.id,
          description: `Payment (${payment.method})`,
          debit: new Prisma.Decimal(0),
          credit: payment.amount,
        });
      }

      entries.sort((left, right) => left.date.getTime() - right.date.getTime());

      let running = new Prisma.Decimal(0);
      const lines: CustomerStatementLineDto[] = entries.map((entry) => {
        running = running.plus(entry.debit).minus(entry.credit);

        return {
          date: entry.date.toISOString().slice(0, 10),
          type: entry.type,
          reference: entry.reference,
          description: entry.description,
          debit: entry.debit.toFixed(2),
          credit: entry.credit.toFixed(2),
          balance: running.toFixed(2),
        };
      });

      const totalInvoiced = invoices.reduce(
        (sum, invoice) => sum.plus(invoice.total),
        new Prisma.Decimal(0),
      );
      const totalPaid = payments.reduce(
        (sum, payment) => sum.plus(payment.amount),
        new Prisma.Decimal(0),
      );
      const openingBalance = new Prisma.Decimal(0);

      return {
        customer: toView(customer, totalInvoiced.minus(totalPaid)),
        openingBalance: openingBalance.toFixed(2),
        totalInvoiced: totalInvoiced.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        closingBalance: running.toFixed(2),
        lines,
      };
    });
  }
}
