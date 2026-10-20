import { NextResponse, type NextRequest } from 'next/server';

import {
  clearRefreshCookie,
  readRefreshToken,
  serverApiUrl,
  setRefreshCookie,
} from '@/lib/server-auth';

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const refreshToken = readRefreshToken(request);

  if (refreshToken === null) {
    return NextResponse.json(
      {
        statusCode: 401,
        error: 'Unauthorized',
        message: 'No session',
        details: { reason: 'NO_SESSION' },
      },
      { status: 401 },
    );
  }

  let refreshResponse: Response;

  try {
    refreshResponse = await fetch(`${serverApiUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { statusCode: 502, error: 'Bad Gateway', message: 'The API is not reachable' },
      { status: 502 },
    );
  }

  const refreshPayload = (await refreshResponse.json().catch(() => null)) as unknown;

  if (!refreshResponse.ok) {
    const response = NextResponse.json(refreshPayload ?? { message: 'Session refresh failed' }, {
      status: refreshResponse.status,
    });
    clearRefreshCookie(response);
    return response;
  }

  const tokens = refreshPayload as RefreshResponse;
  let meResponse: Response;

  try {
    meResponse = await fetch(`${serverApiUrl()}/auth/me`, {
      headers: { authorization: `Bearer ${tokens.accessToken}`, accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { statusCode: 502, error: 'Bad Gateway', message: 'The API is not reachable' },
      { status: 502 },
    );
  }

  const mePayload = (await meResponse.json().catch(() => null)) as unknown;

  if (!meResponse.ok) {
    const response = NextResponse.json(mePayload ?? { message: 'Session refresh failed' }, {
      status: meResponse.status,
    });
    clearRefreshCookie(response);
    return response;
  }

  const me = mePayload as { user: unknown; depot: unknown };
  const response = NextResponse.json({
    accessToken: tokens.accessToken,
    user: me.user,
    depot: me.depot,
  });

  setRefreshCookie(response, tokens.refreshToken);
  return response;
}
