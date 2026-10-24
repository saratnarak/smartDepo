import { ApiError } from '@/lib/api-error';
import { getErrorMessage } from '@/lib/errors';
import type { TranslationParams } from '@/i18n/config';

type Translate = (key: string, params?: TranslationParams) => string;

/**
 * A translation that shows the key and the values, so the test checks which message was picked
 * without repeating the whole dictionary.
 */
const t: Translate = (key, params) => {
  const values = params === undefined ? '' : ` ${JSON.stringify(params)}`;

  return `${key}${values}`;
};

function conflict(reason: string, details: Record<string, unknown>): ApiError {
  return new ApiError('Conflict', 409, { reason, ...details });
}

describe('the messages of the API errors', () => {
  it('names the limit of the staff accounts when the plan is full', () => {
    const message = getErrorMessage(t, conflict('PLAN_USER_LIMIT_REACHED', { maxUsers: 5 }));

    expect(message).toBe('errors.planUserLimit {"max":5}');
  });

  it('names the limit of the products when the plan is full', () => {
    const message = getErrorMessage(t, conflict('PLAN_PRODUCT_LIMIT_REACHED', { maxProducts: 10 }));

    expect(message).toBe('errors.planProductLimit {"max":10}');
  });

  it('uses the singular message for a limit of one', () => {
    expect(getErrorMessage(t, conflict('PLAN_USER_LIMIT_REACHED', { maxUsers: 1 }))).toBe(
      'errors.planUserLimitOne',
    );
    expect(getErrorMessage(t, conflict('PLAN_PRODUCT_LIMIT_REACHED', { maxProducts: 1 }))).toBe(
      'errors.planProductLimitOne',
    );
  });

  it('keeps the plan limit message when the reason has no number', () => {
    const message = getErrorMessage(t, conflict('PLAN_USER_LIMIT_REACHED', {}));

    expect(message).toBe('errors.conflict');
  });

  it('names the duplicate identifier of a staff account', () => {
    expect(getErrorMessage(t, new ApiError('Conflict', 409, { reason: 'IDENTIFIER_TAKEN' }))).toBe(
      'errors.identifierTaken',
    );
  });

  it('names the other failures of the API', () => {
    expect(getErrorMessage(t, new ApiError('Offline', 0))).toBe('errors.network');
    expect(getErrorMessage(t, new ApiError('Forbidden', 403))).toBe('errors.forbidden');
    expect(getErrorMessage(t, new ApiError('Not found', 404))).toBe('errors.notFound');
    expect(getErrorMessage(t, new ApiError('Too many', 429))).toBe('errors.rateLimited');
    expect(getErrorMessage(t, new ApiError('Broken', 400))).toBe('errors.validation');
    expect(getErrorMessage(t, new ApiError('Broken', 500))).toBe('errors.server');
    expect(getErrorMessage(t, new Error('boom'))).toBe('errors.unknown');
  });
});
