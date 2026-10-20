import { HttpException, HttpStatus } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RateLimitGuard } from '../src/common/auth/rate-limit.guard.js';

describe('RateLimitGuard', () => {
  const previousNodeEnv = process.env.NODE_ENV;

  function context(): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => class TestController {},
      switchToHttp: () => ({
        getRequest: () => ({ ip: '203.0.113.9', method: 'POST', url: '/api/v1/auth/login' }),
      }),
    } as unknown as ExecutionContext;
  }

  afterAll(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  it('allows up to the configured number of requests and then returns 429', () => {
    process.env.NODE_ENV = 'production';
    const reflector = {
      getAllAndOverride: () => ({ limit: 2, windowMs: 60_000 }),
    } as unknown as Reflector;
    const guard = new RateLimitGuard(reflector);

    expect(guard.canActivate(context())).toBe(true);
    expect(guard.canActivate(context())).toBe(true);
    expect(() => guard.canActivate(context())).toThrow(HttpException);

    try {
      guard.canActivate(context());
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('skips limiting in the test environment', () => {
    process.env.NODE_ENV = 'test';
    const reflector = {
      getAllAndOverride: () => ({ limit: 1, windowMs: 60_000 }),
    } as unknown as Reflector;
    const guard = new RateLimitGuard(reflector);

    expect(guard.canActivate(context())).toBe(true);
    expect(guard.canActivate(context())).toBe(true);
  });
});
