import { ApiError } from '@/lib/api-error';

/**
 * The API answers a negative-stock adjustment with a 400 and a message that starts with
 * "Insufficient stock". The UI shows a translated headline plus the server detail so the depot
 * understands what happened.
 */
export function insufficientStockDetail(error: unknown): string | null {
  if (
    error instanceof ApiError &&
    error.status === 400 &&
    error.message.trim().startsWith('Insufficient stock')
  ) {
    return error.message.trim();
  }

  return null;
}
