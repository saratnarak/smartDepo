import { NextResponse } from 'next/server';

import { isRecord } from '@/lib/api-error';
import { serverApiUrl, setRefreshCookie } from '@/lib/server-auth';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: unknown;
  depot: unknown;
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);

  if (!isRecord(body) || typeof body.identifier !== 'string' || typeof body.password !== 'string') {
    return NextResponse.json(
      { statusCode: 400, error: 'Bad Request', message: 'Invalid request body' },
      { status: 400 },
    );
  }

  let apiResponse: Response;

  try {
    apiResponse = await fetch(`${serverApiUrl()}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ identifier: body.identifier, password: body.password }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { statusCode: 502, error: 'Bad Gateway', message: 'The API is not reachable' },
      { status: 502 },
    );
  }

  const payload = (await apiResponse.json().catch(() => null)) as unknown;

  if (!apiResponse.ok) {
    return NextResponse.json(payload ?? { message: 'Sign in failed' }, {
      status: apiResponse.status,
    });
  }

  const login = payload as LoginResponse;
  const response = NextResponse.json({
    accessToken: login.accessToken,
    expiresIn: login.expiresIn,
    user: login.user,
    depot: login.depot,
  });

  setRefreshCookie(response, login.refreshToken);
  return response;
}
