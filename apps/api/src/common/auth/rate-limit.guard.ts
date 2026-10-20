import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RATE_LIMIT_KEY } from './rate-limit.decorator.js';
import type { RateLimitOptions } from './rate-limit.decorator.js';

interface Bucket {
  count: number;
  resetAt: number;
}

interface RequestWithIp {
  ip?: string;
  method: string;
  url: string;
}

/**
 * Per-process, per-IP rate limit for annotated routes. Tests skip limiting so their repeated
 * requests from 127.0.0.1 stay deterministic; production and manual runs enforce the limits.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (process.env.NODE_ENV === 'test') {
      return true;
    }

    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (options === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithIp>();
    const key = `${request.ip ?? 'unknown'}:${request.method}:${request.url}`;
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (bucket === undefined || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return true;
    }

    if (bucket.count >= options.limit) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    bucket.count += 1;
    return true;
  }
}
