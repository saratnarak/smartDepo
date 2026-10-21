import { toMoney } from '../../common/money/money.js';
import { Prisma } from '../../generated/prisma/client.js';
import { outstandingFor } from '../invoices/invoice-calculations.js';

/**
 * Payment allocation (FR-26). A payment can cover several invoices or stay partly unallocated as
 * customer credit. The rules are pure functions so they can be tested without a database.
 */

export interface OpenInvoice {
  id: string;
  invoiceNumber: string;
  total: Prisma.Decimal;
  allocated: Prisma.Decimal;
  orderDate: Date;
}

export interface Allocation {
  invoiceId: string;
  amount: Prisma.Decimal;
}

export class AllocationError extends Error {}

/** Spreads the money over the open invoices, oldest invoice first. */
export function allocateAcrossInvoices(
  amount: Prisma.Decimal,
  invoices: readonly OpenInvoice[],
): Allocation[] {
  const ordered = [...invoices].sort((left, right) => {
    const byDate = left.orderDate.getTime() - right.orderDate.getTime();

    return byDate !== 0 ? byDate : left.invoiceNumber.localeCompare(right.invoiceNumber);
  });

  const allocations: Allocation[] = [];
  let remaining = toMoney(amount);

  for (const invoice of ordered) {
    if (remaining.lte(0)) {
      break;
    }

    const outstanding = outstandingFor(invoice.total, invoice.allocated);

    if (outstanding.lte(0)) {
      continue;
    }

    const applied = outstanding.lt(remaining) ? outstanding : remaining;
    allocations.push({ invoiceId: invoice.id, amount: applied });
    remaining = remaining.minus(applied);
  }

  return allocations;
}

/**
 * Checks the allocations a user asked for. An allocation may not be bigger than the open amount of
 * the invoice, may not touch a voided invoice, and the sum may not be bigger than the payment.
 */
export function validateAllocations(
  paymentAmount: Prisma.Decimal,
  allocations: readonly { invoiceId: string; amount: Prisma.Decimal }[],
  invoices: ReadonlyMap<string, OpenInvoice>,
): void {
  let sum = new Prisma.Decimal(0);

  for (const allocation of allocations) {
    const invoice = invoices.get(allocation.invoiceId);

    if (invoice === undefined) {
      throw new AllocationError('One of the invoices does not exist in this depot');
    }

    if (allocation.amount.lte(0)) {
      throw new AllocationError('An allocation must be greater than zero');
    }

    const outstanding = outstandingFor(invoice.total, invoice.allocated);

    if (allocation.amount.gt(outstanding)) {
      throw new AllocationError(
        `The allocation for ${invoice.invoiceNumber} is bigger than the open amount of ${outstanding.toFixed(2)}`,
      );
    }

    sum = sum.plus(allocation.amount);
  }

  if (sum.gt(paymentAmount)) {
    throw new AllocationError(
      `The allocations add up to ${sum.toFixed(2)}, which is more than the payment of ${paymentAmount.toFixed(2)}`,
    );
  }
}
