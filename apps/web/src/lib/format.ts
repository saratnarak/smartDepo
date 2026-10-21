import type { Locale } from '@/i18n/config';

const LOCALE_TAGS: Record<Locale, string> = {
  en: 'en-GB',
  km: 'km-KH',
};

/**
 * Currencies that are used without a minor unit. The depot currency decides how many decimals an
 * amount is shown with; the stored value stays NUMERIC and is never rounded in the database.
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'KHR',
  'JPY',
  'KRW',
  'VND',
  'LAK',
  'CLP',
  'ISK',
  'MMK',
  'KHR ',
]);

export function moneyDecimals(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.trim().toUpperCase()) ? 0 : 2;
}

/**
 * Formats a NUMERIC(14,2) money string without converting it to a JavaScript number. Grouping is
 * applied to the integer part as a BigInt and the fraction digits are kept as text. The number of
 * decimals follows the depot currency: KHR has no minor unit, so whole amounts are shown without
 * decimals, while an amount that really has cents keeps them so no information is lost.
 */
export function formatMoney(
  amount: string,
  currency: string,
  locale: Locale,
  options: { decimals?: number } = {},
): string {
  const currencyDecimals = moneyDecimals(currency);
  const match = /^(-?)(\d+)(?:\.(\d{1,4}))?$/.exec(amount.trim());

  if (match === null) {
    return `${amount} ${currency}`;
  }

  const fraction = match[3] ?? '';
  const hasCents = fraction !== '' && /[1-9]/.test(fraction);
  const decimals =
    options.decimals ??
    (hasCents ? (currencyDecimals === 0 ? fraction.length : currencyDecimals) : currencyDecimals);

  const scale = 4n;
  const scaled = BigInt(match[2]) * 10n ** scale + BigInt(`${fraction}0000`.slice(0, 4));
  const divisor = 10n ** (scale - BigInt(decimals));
  const rounded = (scaled + divisor / 2n) / divisor;
  const factor = 10n ** BigInt(decimals);

  const negative = match[1] === '-';
  const integer = rounded / factor;
  const digits = (rounded % factor).toString().padStart(decimals, '0').slice(0, decimals);
  const grouped = new Intl.NumberFormat(LOCALE_TAGS[locale], {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(integer);

  return `${negative ? '-' : ''}${grouped}${decimals > 0 ? `.${digits}` : ''} ${currency}`;
}

/** The same as formatMoney but without the currency code. */
export function formatAmount(
  amount: string,
  currency: string,
  locale: Locale,
  options: { decimals?: number } = {},
): string {
  return formatMoney(amount, currency, locale, options).replace(/\s[A-Z]{3}$/, '');
}

export function formatDate(value: string | Date, locale: Locale): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part !== '');

  if (parts.length === 0) {
    return '?';
  }

  return parts
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('');
}
