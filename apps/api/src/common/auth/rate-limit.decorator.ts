import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

/**
 * Marks a route with a simple in-memory per-IP rate limit. Used for registration, login, and token
 * refresh. The guard is intentionally local to this project so the API does not depend on a
 * framework-specific throttling package.
 */
export const RateLimit = (limit: number, windowMs = 60_000): MethodDecorator & ClassDecorator =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowMs });
