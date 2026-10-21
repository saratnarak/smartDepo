import { Prisma } from '../../generated/prisma/client.js';

/** Money is stored as NUMERIC(14,2); never use floating point arithmetic for it. */
export const MONEY_SCALE = 2;

const ROUNDING = Prisma.Decimal.ROUND_HALF_UP;

export type MoneyInput = string | number | Prisma.Decimal;

export function toMoney(value: MoneyInput): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(MONEY_SCALE, ROUNDING);
}

/** Quantity times a per-unit cost, rounded to the money scale. */
export function calculateLineTotal(quantity: MoneyInput, unitCost: MoneyInput): Prisma.Decimal {
  return toMoney(new Prisma.Decimal(quantity).times(new Prisma.Decimal(unitCost)));
}

/**
 * Converts a cost entered for one product unit into the cost of one base unit. For example a
 * carton of 24 bottles at 24.00 has a base-unit cost of 1.00.
 */
export function toBaseUnitCost(unitCost: MoneyInput, conversionFactor: MoneyInput): Prisma.Decimal {
  return toMoney(new Prisma.Decimal(unitCost).div(new Prisma.Decimal(conversionFactor)));
}

/** Adds money strings with decimal arithmetic. */
export function sumMoney(values: readonly string[]): Prisma.Decimal {
  return values.reduce(
    (total, value) => total.plus(new Prisma.Decimal(value)),
    new Prisma.Decimal(0),
  );
}

/** Compares two money strings: -1 when left is smaller, 1 when it is bigger, 0 when equal. */
export function compareMoney(left: string, right: string): number {
  return new Prisma.Decimal(left).comparedTo(new Prisma.Decimal(right));
}
