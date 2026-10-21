/**
 * Decimal string patterns for DTOs. Quantities and factors are accepted as strings so JSON numbers
 * never lose precision. The service converts them with Prisma.Decimal.
 */
export const DECIMAL_3_PATTERN = /^\d{1,15}(\.\d{1,3})?$/;
export const SIGNED_DECIMAL_3_PATTERN = /^-?\d{1,15}(\.\d{1,3})?$/;
export const DECIMAL_6_PATTERN = /^\d{1,12}(\.\d{1,6})?$/;
export const MONEY_2_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;

export const DECIMAL_3_MESSAGE = 'must be a non-negative decimal with at most 3 decimal places';
export const SIGNED_DECIMAL_3_MESSAGE = 'must be a decimal with at most 3 decimal places';
export const DECIMAL_6_MESSAGE = 'must be a positive decimal with at most 6 decimal places';
export const MONEY_2_MESSAGE = 'must be a non-negative amount with at most 2 decimal places';
