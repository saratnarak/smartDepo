import { ApiError } from '@/lib/api-error';
import type { TranslationParams } from '@/i18n/config';

type Translate = (key: string, params?: TranslationParams) => string;

export interface TranslatedError {
  title: string;
  detail: string | null;
}

/**
 * Turns the answer of the API into a message the user understands. The API answers with clear
 * English sentences; the screen shows a translated headline and keeps the server detail so
 * nothing is hidden from the user.
 */
export function translateInvoiceError(t: Translate, error: unknown): TranslatedError {
  if (!(error instanceof ApiError)) {
    return { title: t('errors.unknown'), detail: null };
  }

  if (error.status === 403) {
    return { title: t('errors.forbidden'), detail: null };
  }

  if (error.status === 404) {
    return { title: t('errors.notFound'), detail: null };
  }

  if (error.status !== 400 && error.status !== 422) {
    return { title: t('errors.unknown'), detail: null };
  }

  const message = error.message.trim();

  if (message.startsWith('Insufficient stock')) {
    return { title: t('invoices.errorInsufficientStock'), detail: message };
  }

  if (message.startsWith('Not enough usable stock in the batches')) {
    return { title: t('invoices.errorBatches'), detail: message };
  }

  if (message.includes('credit limit')) {
    return { title: t('invoices.errorCreditLimit'), detail: message };
  }

  if (message.startsWith('No retail price') || message.startsWith('No wholesale price')) {
    return { title: t('invoices.errorNoPrice'), detail: message };
  }

  if (message.startsWith('Only the depot owner')) {
    return { title: t('invoices.errorPriceOverride'), detail: message };
  }

  if (message.includes('A batch is required')) {
    return { title: t('invoices.errorBatchRequired'), detail: message };
  }

  if (error.fieldErrors.length > 0) {
    return { title: t('errors.validation'), detail: null };
  }

  return { title: message === '' ? t('errors.validation') : message, detail: null };
}
