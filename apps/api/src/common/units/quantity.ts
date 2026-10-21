import { Prisma } from '../../generated/prisma/client.js';

/** Quantities are stored as NUMERIC(18,3), so converted values are rounded to three decimals. */
export const QUANTITY_SCALE = 3;

const ROUNDING = Prisma.Decimal.ROUND_HALF_UP;
const INVARIANT_UNIT_NAMES = /^(kg|g|mg|t|lb|oz|l|ml|cl|m|cm|mm|km|pcs|pc)$/i;

export type DecimalInput = string | number | Prisma.Decimal;

export interface UnitConversion {
  name: string;
  conversionFactor: DecimalInput;
  isBaseUnit?: boolean;
  isActive?: boolean;
}

function toDecimal(value: DecimalInput, label: string): Prisma.Decimal {
  try {
    const decimal = new Prisma.Decimal(value);
    if (!decimal.isFinite()) {
      throw new Error('not finite');
    }
    return decimal;
  } catch {
    throw new RangeError(`${label} must be a valid decimal`);
  }
}

/**
 * Converts a quantity entered in a product unit into the product base unit. Both values are
 * decimal strings/Prisma decimals; floating point is never used.
 */
export function toBaseQuantity(
  quantity: DecimalInput,
  conversionFactor: DecimalInput,
): Prisma.Decimal {
  const amount = toDecimal(quantity, 'quantity');
  const factor = toDecimal(conversionFactor, 'conversion factor');

  if (factor.lte(0)) {
    throw new RangeError('conversion factor must be positive');
  }

  return amount.times(factor).toDecimalPlaces(QUANTITY_SCALE, ROUNDING);
}

/** Validates a factor for an additional unit: positive and not the base unit's factor of 1. */
export function assertNonBaseConversionFactor(factor: DecimalInput): Prisma.Decimal {
  const decimal = toDecimal(factor, 'conversion factor');

  if (decimal.lte(0)) {
    throw new RangeError('conversion factor must be positive');
  }
  if (decimal.eq(1)) {
    throw new RangeError('an additional unit must have a conversion factor different from 1');
  }

  return decimal;
}

/** Validates the base unit's factor. */
export function assertBaseConversionFactor(factor: DecimalInput): Prisma.Decimal {
  const decimal = toDecimal(factor, 'conversion factor');

  if (!decimal.eq(1)) {
    throw new RangeError('the base unit must have a conversion factor of 1');
  }

  return decimal;
}

/** Validates a non-negative quantity such as a purchase line or reorder level. */
export function assertNonNegativeQuantity(quantity: DecimalInput): Prisma.Decimal {
  const decimal = toDecimal(quantity, 'quantity');

  if (decimal.lt(0)) {
    throw new RangeError('quantity must not be negative');
  }

  return decimal;
}

/** Validates a positive quantity such as a purchase or damage line. */
export function assertPositiveQuantity(quantity: DecimalInput): Prisma.Decimal {
  const decimal = toDecimal(quantity, 'quantity');

  if (decimal.lte(0)) {
    throw new RangeError('quantity must be greater than zero');
  }

  return decimal;
}

/** Validates a non-zero signed quantity such as a manual stock adjustment. */
export function assertNonZeroQuantity(quantity: DecimalInput): Prisma.Decimal {
  const decimal = toDecimal(quantity, 'quantity');

  if (decimal.eq(0)) {
    throw new RangeError('quantity must not be zero');
  }

  return decimal;
}

function trimDecimal(value: Prisma.Decimal): string {
  const fixed = value.toFixed(QUANTITY_SCALE);
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
}

function unitLabel(name: string, quantity: Prisma.Decimal): string {
  if (quantity.eq(1) || INVARIANT_UNIT_NAMES.test(name) || name.endsWith('s')) {
    return name;
  }
  if (/(x|ch|sh|ss)$/i.test(name)) {
    return `${name}es`;
  }
  return `${name}s`;
}

function formatPart(quantity: Prisma.Decimal, unitName: string): string {
  return `${trimDecimal(quantity)} ${unitLabel(unitName, quantity)}`;
}

/**
 * Formats a base-unit quantity as readable units, largest unit first. Example: 293 bottles with a
 * carton factor of 24 becomes "12 cartons and 5 bottles". Fractional base units are preserved, so
 * 52.25 kg with a 50 kg sack becomes "1 sack and 2.25 kg".
 */
export function formatBaseQuantity(
  baseQuantity: DecimalInput,
  units: readonly UnitConversion[],
): string {
  const quantity = toDecimal(baseQuantity, 'base quantity');
  const baseUnit = units.find((unit) => unit.isBaseUnit === true);

  if (baseUnit === undefined) {
    throw new RangeError('a base unit is required to format a quantity');
  }

  const negative = quantity.isNegative();
  let remainder = quantity.abs();

  const largerUnits = units
    .filter((unit) => unit.isBaseUnit !== true && unit.isActive !== false)
    .map((unit) => ({
      name: unit.name,
      factor: toDecimal(unit.conversionFactor, 'conversion factor'),
    }))
    .filter((unit) => {
      if (unit.factor.lte(0)) {
        throw new RangeError('conversion factor must be positive');
      }
      return unit.factor.gt(1);
    })
    .sort((left, right) => right.factor.comparedTo(left.factor));

  const parts: string[] = [];

  for (const unit of largerUnits) {
    const whole = remainder.div(unit.factor).floor();
    if (whole.gt(0)) {
      parts.push(formatPart(whole, unit.name));
      remainder = remainder.minus(whole.times(unit.factor));
    }
  }

  if (remainder.gt(0) || parts.length === 0) {
    parts.push(formatPart(remainder, baseUnit.name));
  }

  return `${negative ? '-' : ''}${parts.join(' and ')}`;
}
