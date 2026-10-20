'use client';

import { useI18n } from '@/components/i18n-provider';
import type { Locale } from '@/i18n/config';

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();

  const options: Array<{ value: Locale; label: string }> = [
    { value: 'en', label: compact ? t('common.englishShort') : t('common.english') },
    { value: 'km', label: t('common.khmer') },
  ];

  return (
    <div className="language-switch" role="group" aria-label={t('common.language')}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="language-switch__button"
          aria-pressed={locale === option.value}
          onClick={() => setLocale(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
