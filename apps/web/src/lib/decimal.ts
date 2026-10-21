/**
 * Decimal-string helpers for the catalog UI. Quantities, conversion factors, and money are always
 * handled as strings (or scaled BigInt) so the browser never does floating-point arithmetic on
 * values that come from or go to PostgreSQL NUMERIC columns.
 */

const SCALE = 6;
const SCALE_FACTOR = 10n ** BigInt(SCALE);
const DECIMAL_PATTERN = /^\d+(?:\.\d{1,6})?$/;
const SIGNED_DECIMAL_PATTERN = /^-?\d+(?:\.\d{1,6})?$/;
const QUANTITY_PATTERN = /^\d{1,15}(?:\.\d{1,3})?$/;
const SIGNED_QUANTITY_PATTERN = /^-?\d{1,15}(?:\.\d{1,3})?$/;
const FACTOR_PATTERN = /^\d{1,12}(?:\.\d{1,6})?$/;
const MONEY_PATTERN = /^\d{1,12}(?:\.\d{1,2})?$/;
const INVARIANT_UNIT_NAMES = /^(kg|g|mg|t|lb|oz|l|ml|cl|m|cm|mm|km|pcs|pc)$/i;

export interface UnitLike {
  name: string;
  conversionFactor: string;
  isBaseUnit: boolean;
  isActive?: boolean;
}

export function toScaled(value: string): bigint | null {
  const trimmed = value.trim();

  if (!DECIMAL_PATTERN.test(trimmed)) {
    return null;
  }

  const [integer, fraction = ''] = trimmed.split('.');
  return BigInt(integer) * SCALE_FACTOR + BigInt(fraction.padEnd(SCALE, '0'));
}

/** Same as toScaled but accepts a leading minus sign, for adjustments and returns. */
export function toSignedScaled(value: string): bigint | null {
  const trimmed = value.trim();

  if (!SIGNED_DECIMAL_PATTERN.test(trimmed)) {
    return null;
  }

  const negative = trimmed.startsWith('-');
  const absolute = toScaled(trimmed.replace('-', ''));

  if (absolute === null) {
    return null;
  }

  return negative ? -absolute : absolute;
}

export function fromScaled(value: bigint): string {
  if (value < 0n) {
    return `-${fromScaled(-value)}`;
  }

  const integer = value / SCALE_FACTOR;
  const fraction = (value % SCALE_FACTOR).toString().padStart(SCALE, '0');

  if (fraction === '000000') {
    return integer.toString();
  }

  return `${integer.toString()}.${fraction.replace(/0+$/, '')}`;
}

/** Trims a decimal string for display without converting it to a JavaScript number. */
export function formatDecimal(value: string): string {
  const scaled = toScaled(value);
  return scaled === null ? value : fromScaled(scaled);
}

export function compareDecimal(left: string, right: string): number | null {
  const a = toScaled(left);
  const b = toScaled(right);

  if (a === null || b === null) {
    return null;
  }

  return a < b ? -1 : a > b ? 1 : 0;
}

export function isValidQuantity(value: string): boolean {
  return QUANTITY_PATTERN.test(value.trim());
}

export function isValidPrice(value: string): boolean {
  return MONEY_PATTERN.test(value.trim());
}

export function isValidConversionFactor(value: string): boolean {
  const trimmed = value.trim();

  if (!FACTOR_PATTERN.test(trimmed)) {
    return false;
  }

  const scaled = toScaled(trimmed);
  return scaled !== null && scaled > 0n && scaled !== SCALE_FACTOR;
}

function unitLabel(name: string, quantity: bigint, pluralize: boolean): string {
  if (
    !pluralize ||
    quantity === SCALE_FACTOR ||
    INVARIANT_UNIT_NAMES.test(name) ||
    name.endsWith('s')
  ) {
    return name;
  }

  if (/(x|ch|sh|ss)$/i.test(name)) {
    return `${name}es`;
  }

  return `${name}s`;
}

function formatPart(quantity: bigint, unitName: string, pluralize: boolean): string {
  return `${fromScaled(quantity)} ${unitLabel(unitName, quantity, pluralize)}`;
}

export interface ReadableQuantityOptions {
  conjunction?: string;
  pluralize?: boolean;
}

/**
 * Mirrors the API's readable-unit formatter: largest unit first, then the base unit. Example:
 * 293 bottles with a carton factor of 24 becomes "12 cartons and 5 bottles".
 */
export function formatReadableQuantity(
  baseQuantity: string,
  units: readonly UnitLike[],
  options: ReadableQuantityOptions = {},
): string {
  const baseUnit = units.find((unit) => unit.isBaseUnit);
  const baseScaled = toScaled(baseQuantity);

  if (baseUnit === undefined || baseScaled === null) {
    return formatDecimal(baseQuantity);
  }

  const conjunction = options.conjunction ?? 'and';
  const pluralize = options.pluralize ?? true;
  let remainder = baseScaled;
  const parts: string[] = [];

  const largerUnits = units
    .filter((unit) => !unit.isBaseUnit && unit.isActive !== false)
    .map((unit) => ({ name: unit.name, factor: toScaled(unit.conversionFactor) }))
    .filter((unit): unit is { name: string; factor: bigint } => unit.factor !== null)
    .filter((unit) => unit.factor > SCALE_FACTOR)
    .sort((left, right) => (right.factor > left.factor ? 1 : right.factor < left.factor ? -1 : 0));

  for (const unit of largerUnits) {
    const whole = remainder / unit.factor;

    if (whole > 0n) {
      parts.push(formatPart(whole * SCALE_FACTOR, unit.name, pluralize));
      remainder -= whole * unit.factor;
    }
  }

  if (remainder > 0n || parts.length === 0) {
    parts.push(formatPart(remainder, baseUnit.name, pluralize));
  }

  return parts.join(` ${conjunction} `);
}

/** Example: "1 carton = 24 bottles". */
export function formatUnitPreview(
  unitName: string,
  conversionFactor: string,
  baseUnitName: string,
  pluralize = true,
): string {
  const factor = toScaled(conversionFactor);
  const name = unitName.trim() === '' ? '…' : unitName.trim();
  const base = baseUnitName.trim() === '' ? '…' : baseUnitName.trim();

  if (factor === null) {
    return `1 ${name} = ${conversionFactor} ${base}`;
  }

  return `1 ${name} = ${formatPart(factor, base, pluralize)}`;
}

/**
 * Rounds a scaled BigInt half away from zero, the same way the API rounds money and quantities.
 */
function roundScaled(value: bigint, divisor: bigint): bigint {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const rounded = (absolute + divisor / 2n) / divisor;

  return negative ? -rounded : rounded;
}

/** Rounds a decimal string to the given number of decimals, or null when it is not a number. */
export function roundTo(value: string, decimals: number): string | null {
  const scaled = toSignedScaled(value);

  if (scaled === null) {
    return null;
  }

  const divisor = decimals >= SCALE ? 1n : 10n ** BigInt(SCALE - decimals);
  const rounded = roundScaled(scaled, divisor);
  return fromScaled(rounded * divisor);
}

/** Rounds to the money scale of NUMERIC(14,2). */
export function roundToMoney(value: string): string | null {
  return roundTo(value, 2);
}

/** Rounds to the money scale and keeps two decimals for display, for example "288.00". */
export function toMoneyString(value: string): string | null {
  const rounded = roundToMoney(value);

  if (rounded === null) {
    return null;
  }

  const [integer, fraction = ''] = rounded.split('.');
  return `${integer}.${fraction.padEnd(2, '0')}`;
}

/** Rounds to the quantity scale of NUMERIC(18,3). */
export function roundToQuantity(value: string): string | null {
  return roundTo(value, 3);
}

/** Multiplies two decimal strings without floating-point arithmetic. */
export function multiplyDecimal(left: string, right: string): string | null {
  const a = toSignedScaled(left);
  const b = toSignedScaled(right);

  if (a === null || b === null) {
    return null;
  }

  return fromScaled(roundScaled(a * b, SCALE_FACTOR));
}

/** Divides two decimal strings without floating-point arithmetic. */
export function divideDecimal(left: string, right: string): string | null {
  const a = toSignedScaled(left);
  const b = toSignedScaled(right);

  if (a === null || b === null || b === 0n) {
    return null;
  }

  return fromScaled(roundScaled(a * SCALE_FACTOR, b));
}

/** Adds decimal strings without floating-point arithmetic. */
export function sumDecimals(values: readonly string[]): string | null {
  let total = 0n;

  for (const value of values) {
    const scaled = toSignedScaled(value);

    if (scaled === null) {
      return null;
    }

    total += scaled;
  }

  return fromScaled(total);
}

/** Converts an entered quantity in a product unit into the base unit. */
export function toBaseQuantity(quantity: string, conversionFactor: string): string | null {
  return multiplyDecimal(quantity, conversionFactor);
}

/** Converts the cost of one entered unit into the cost of one base unit. */
export function toBaseUnitCost(unitCost: string, conversionFactor: string): string | null {
  const divided = divideDecimal(unitCost, conversionFactor);

  return divided === null ? null : roundToMoney(divided);
}

/** Line total of a purchase line: quantity multiplied by the entered unit cost. */
export function calculateLineTotal(quantity: string, unitCost: string): string | null {
  const product = multiplyDecimal(quantity, unitCost);

  return product === null ? null : roundToMoney(product);
}

/** True when the value is a valid signed quantity such as "-2.5". */
export function isValidSignedQuantity(value: string): boolean {
  return SIGNED_QUANTITY_PATTERN.test(value.trim());
}

/** True when the value is a valid quantity greater than zero. */
export function isPositiveQuantity(value: string): boolean {
  const scaled = toSignedScaled(value);

  return scaled !== null && scaled > 0n && isValidQuantity(value);
}
