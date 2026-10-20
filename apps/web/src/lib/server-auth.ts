import type { NextRequest, NextResponse } from 'next/server';

export const REFRESH_COOKIE = 'smartdepo_refresh';

const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function serverApiUrl(): string {
  const target = (
    process.env.API_INTERNAL_URL ??
    process.env.API_PROXY_TARGET ??
    'http://localhost:3001'
  ).replace(/\/+$/, '');

  return `${target}/api/v1`;
}

export function readRefreshToken(request: NextRequest): string | null {
  return request.cookies.get(REFRESH_COOKIE)?.value ?? null;
}

export function setRefreshCookie(response: NextResponse, token: string): void {
  response.cookies.set(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
}

export function clearRefreshCookie(response: NextResponse): void {
  response.cookies.set(REFRESH_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 0,
  });
}
