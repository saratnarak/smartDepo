import {
  divideDecimal,
  multiplyDecimal,
  roundToMoney,
  sumDecimals,
  toBaseQuantity,
} from '@/lib/decimal';
import type { DiscountType } from '@/lib/types';

/**
 * The invoice screen works with decimal strings only. Every amount is calculated with the
 * scaled BigInt helpers in `lib/decimal.ts`, so the browser never does floating-point arithmetic.
 * The server recalculates everything anyway and its answer is the one that is shown after saving.
 */

export interface InvoiceLineDraft {
  productId: string;
  productSku: string;
  productName: string;
  unitId: string;
  unitName: string;
  conversionFactor: string;
  quantity: string;
  unitPrice: string;
  priceOverridden: boolean;
  discountType: DiscountType | null;
  discountValue: string;
  trackBatches: boolean;
}

export interface DraftTotals {
  subtotal: string;
  discountTotal: string;
  total: string;
}

const ZERO = '0';

function safe(value: string | null): string {
  return value === null ? ZERO : value;
}

/** A minus B, both decimal strings. */
export function subtractDecimals(left: string, right: string): string {
  return safe(sumDecimals([left, `-${right}`]));
}

/**
 * The discount of a line or of the invoice. A percentage is taken from the base amount, a fixed
 * amount is used as it is, and a discount never takes more than the amount it discounts.
 */
export function applyDiscount(base: string, type: DiscountType | null, value: string): string {
  if (type === null || value.trim() === '') {
    return ZERO;
  }

  const amount =
    type === 'PERCENT'
      ? safe(roundToMoney(safe(divideDecimal(safe(multiplyDecimal(base, value.trim())), '100'))))
      : safe(roundToMoney(value.trim()));

  return compareDecimals(amount, base) > 0 ? base : amount;
}

/** Compares two decimal strings: -1 when left is smaller, 1 when it is bigger, 0 when equal. */
export function compareDecimals(left: string, right: string): number {
  const a = roundToSix(left);
  const b = roundToSix(right);

  if (a === null || b === null) {
    return 0;
  }

  return a < b ? -1 : a > b ? 1 : 0;
}

function roundToSix(value: string): bigint | null {
  const trimmed = value.trim();

  if (!/^-?\d{1,15}(\.\d{1,6})?$/.test(trimmed)) {
    return null;
  }

  const negative = trimmed.startsWith('-');
  const [integer, fraction = ''] = trimmed.replace('-', '').split('.');
  const scaled = BigInt(integer) * 1000000n + BigInt(fraction.padEnd(6, '0'));

  return negative ? -scaled : scaled;
}

/** The gross of a line: quantity times the unit price, rounded to the money scale. */
export function lineGross(line: InvoiceLineDraft): string {
  return safe(roundToMoney(safe(multiplyDecimal(line.quantity.trim(), line.unitPrice.trim()))));
}

/** The discount of a line. */
export function lineDiscount(line: InvoiceLineDraft): string {
  return applyDiscount(lineGross(line), line.discountType, line.discountValue);
}

/** The total of a line after its discount. */
export function lineTotal(line: InvoiceLineDraft): string {
  return safe(roundToMoney(subtractDecimals(lineGross(line), lineDiscount(line))));
}

/** The sum of the line totals before the invoice discount. */
export function draftSubtotal(lines: readonly InvoiceLineDraft[]): string {
  return safe(roundToMoney(safe(sumDecimals(lines.map((line) => lineTotal(line))))));
}

/** The subtotal, the invoice discount, and the total of the invoice. */
export function draftTotals(
  lines: readonly InvoiceLineDraft[],
  discountType: DiscountType | null = null,
  discountValue = '',
): DraftTotals {
  const subtotal = draftSubtotal(lines);
  const discountTotal = applyDiscount(subtotal, discountType, discountValue);

  return {
    subtotal,
    discountTotal,
    total: safe(roundToMoney(subtractDecimals(subtotal, discountTotal))),
  };
}

/** The quantity of a line in the base unit of the product. */
export function lineBaseQuantity(line: InvoiceLineDraft): string {
  return safe(toBaseQuantity(line.quantity.trim(), line.conversionFactor));
}

/** The quantity of the batches that can still be sold (unexpired ones only). */
export function usableBatchQuantity(
  batches: ReadonlyArray<{ quantity: string; expiryDate: string | null }>,
  today: string,
): string {
  const usable = batches
    .filter((batch) => batch.expiryDate === null || batch.expiryDate >= today)
    .map((batch) => batch.quantity);

  return safe(sumDecimals(usable));
}

/** A key that makes a retried invoice create return the same invoice. */
export function newIdempotencyKey(): string {
  const cryptoRef = globalThis.crypto;

  if (typeof cryptoRef?.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }

  return `invoice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * The key of the current attempt. A failed attempt keeps its key so that a retry cannot write a
 * second invoice; a new attempt (a fresh screen or a saved invoice) gets a new key.
 */
export function keyForAttempt(current: string | null, hasSubmitted: boolean): string {
  if (hasSubmitted && current !== null && current !== '') {
    return current;
  }

  return newIdempotencyKey();
}
