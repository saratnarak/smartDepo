import { toMoney } from '../../common/money/money.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { DiscountType, PaymentStatus } from '../../generated/prisma/enums.js';

/**
 * Invoice arithmetic (FR-29, FR-32). Every amount is a decimal string that becomes a
 * `Prisma.Decimal`; the browser and the API never use floating point. The server always
 * recalculates the totals, so a client cannot change them.
 */

export interface DiscountInput {
  type: DiscountType;
  value: string;
}

export interface CalculatedLine {
  gross: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

/**
 * The discount of a line or of the invoice. A percentage is taken from the base amount, a fixed
 * amount is used as it is, and a discount never exceeds the amount it discounts.
 */
export function calculateDiscountAmount(
  base: Prisma.Decimal,
  discount?: DiscountInput | null,
): Prisma.Decimal {
  if (discount === null || discount === undefined) {
    return new Prisma.Decimal(0);
  }

  const value = new Prisma.Decimal(discount.value);

  if (!value.isFinite()) {
    throw new RangeError('discount value must be a number');
  }

  if (value.isNegative()) {
    throw new RangeError('discount value must not be negative');
  }

  const amount = discount.type === 'PERCENT' ? toMoney(base.times(value).div(100)) : toMoney(value);

  return amount.gt(base) ? base : amount;
}

export function calculateLineTotals(input: {
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discount?: DiscountInput | null;
}): CalculatedLine {
  const gross = toMoney(input.quantity.times(input.unitPrice));
  const discountAmount = calculateDiscountAmount(gross, input.discount);

  return {
    gross,
    discountAmount,
    lineTotal: toMoney(gross.minus(discountAmount)),
  };
}

export interface InvoiceTotals {
  subtotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  total: Prisma.Decimal;
}

export function calculateInvoiceTotals(
  lines: readonly { lineTotal: Prisma.Decimal }[],
  discount?: DiscountInput | null,
): InvoiceTotals {
  const subtotal = toMoney(
    lines.reduce((sum, line) => sum.plus(line.lineTotal), new Prisma.Decimal(0)),
  );
  const discountTotal = calculateDiscountAmount(subtotal, discount);

  return {
    subtotal,
    discountTotal,
    total: toMoney(subtotal.minus(discountTotal)),
  };
}

/** PAID when the invoice is covered, PARTIAL when some money arrived, UNPAID otherwise. */
export function paymentStatusFor(total: Prisma.Decimal, allocated: Prisma.Decimal): PaymentStatus {
  if (allocated.gte(total)) {
    return 'PAID';
  }

  if (allocated.gt(0)) {
    return 'PARTIAL';
  }

  return 'UNPAID';
}

/** The part of an invoice that is still open. Never negative. */
export function outstandingFor(total: Prisma.Decimal, allocated: Prisma.Decimal): Prisma.Decimal {
  const outstanding = toMoney(total.minus(allocated));
  return outstanding.isNegative() ? new Prisma.Decimal(0) : outstanding;
}
