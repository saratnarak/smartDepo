import { ApiError } from '@/lib/api-error';
import type { TranslationParams } from '@/i18n/config';

type Translate = (key: string, params?: TranslationParams) => string;

export function getErrorMessage(t: Translate, error: unknown): string {
  if (!(error instanceof ApiError)) {
    return t('errors.unknown');
  }

  if (error.status === 0) {
    return t('errors.network');
  }

  if (error.status === 409) {
    return error.detailReason === 'IDENTIFIER_TAKEN'
      ? t('errors.identifierTaken')
      : t('errors.conflict');
  }

  if (error.status === 400 || error.status === 422) {
    return t('errors.validation');
  }

  switch (error.status) {
    case 401:
      return t('errors.unauthorized');
    case 403:
      return t('errors.forbidden');
    case 404:
      return t('errors.notFound');
    case 429:
      return t('errors.rateLimited');
    default:
      return error.status >= 500 ? t('errors.server') : t('errors.unknown');
  }
}
