import { Prisma } from '../../generated/prisma/client.js';
import {
  assertPositiveQuantity,
  formatBaseQuantity,
  type DecimalInput,
  type UnitConversion,
} from '../../common/units/quantity.js';

/** Sums signed movement quantities. Positive increases stock, negative decreases it. */
export function stockFromMovements(quantities: readonly DecimalInput[]): Prisma.Decimal {
  return quantities.reduce<Prisma.Decimal>(
    (total, quantity) => total.plus(new Prisma.Decimal(quantity)),
    new Prisma.Decimal(0),
  );
}

export function isLowStock(currentStock: DecimalInput, reorderLevel: DecimalInput): boolean {
  return new Prisma.Decimal(currentStock).lte(new Prisma.Decimal(reorderLevel));
}

export function readableStock(
  currentStock: DecimalInput,
  units: readonly UnitConversion[],
): string {
  return formatBaseQuantity(currentStock, units);
}

/** Damage is always recorded as a negative movement; the request itself carries a positive amount. */
export function damageQuantity(quantity: DecimalInput): Prisma.Decimal {
  return assertPositiveQuantity(quantity).negated();
}
