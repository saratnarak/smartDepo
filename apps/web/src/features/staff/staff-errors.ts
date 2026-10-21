import { ApiError } from '@/lib/api-error';
import { getErrorMessage } from '@/lib/errors';
import type { TranslationParams } from '@/i18n/config';

type Translate = (key: string, params?: TranslationParams) => string;

/**
 * Staff create and update return 409 without a reason for duplicate identifiers. Show the useful
 * message instead of the generic conflict text. Plan-limit 409s keep their specific message.
 */
export function staffErrorMessage(t: Translate, error: unknown): string {
  if (error instanceof ApiError && error.status === 409 && error.detailReason === null) {
    return t('errors.identifierTaken');
  }

  return getErrorMessage(t, error);
}
