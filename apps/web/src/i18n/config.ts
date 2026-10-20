import en from './en.json';
import km from './km.json';

export const locales = ['en', 'km'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const LOCALE_COOKIE = 'smartdepo_locale';

export type TranslationParams = Record<string, string | number>;

export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'en' || value === 'km';
}

export function translate(locale: Locale, key: string, params?: TranslationParams): string {
  const dictionary = locale === 'km' ? km : en;
  let current: unknown = dictionary;

  for (const segment of key.split('.')) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return key;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  if (typeof current !== 'string') {
    return key;
  }

  return current.replace(/\{(\w+)\}/g, (match, name: string) =>
    params?.[name] === undefined ? match : String(params[name]),
  );
}
