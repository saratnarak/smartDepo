import { ApiError, isRecord } from '@/lib/api-error';
import type { TranslationParams } from '@/i18n/config';

type Translate = (key: string, params?: TranslationParams) => string;

function planUserLimit(error: ApiError): number | null {
  if (
    error.detailReason !== 'PLAN_USER_LIMIT_REACHED' ||
    !isRecord(error.details) ||
    typeof error.details.maxUsers !== 'number'
  ) {
    return null;
  }

  return error.details.maxUsers;
}

function planProductLimit(error: ApiError): number | null {
  if (
    error.detailReason !== 'PLAN_PRODUCT_LIMIT_REACHED' ||
    !isRecord(error.details) ||
    typeof error.details.maxProducts !== 'number'
  ) {
    return null;
  }

  return error.details.maxProducts;
}

export function getErrorMessage(t: Translate, error: unknown): string {
  if (!(error instanceof ApiError)) {
    return t('errors.unknown');
  }

  if (error.status === 0) {
    return t('errors.network');
  }

  if (error.status === 409) {
    const maxUsers = planUserLimit(error);
    const maxProducts = planProductLimit(error);

    if (maxUsers !== null) {
      return maxUsers === 1
        ? t('errors.planUserLimitOne')
        : t('errors.planUserLimit', { max: maxUsers });
    }

    if (maxProducts !== null) {
      return maxProducts === 1
        ? t('errors.planProductLimitOne')
        : t('errors.planProductLimit', { max: maxProducts });
    }

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
