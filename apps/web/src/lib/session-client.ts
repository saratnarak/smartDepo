'use client';

import { ApiError, networkError, parseErrorResponse } from '@/lib/api-error';
import type { AuthSession, LogoutReason, SessionDepot, SessionUser } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';

const AUTH_BASE = '/api/auth';

interface RefreshPayload {
  accessToken: string;
  user: SessionUser;
  depot: SessionDepot | null;
}

export type RefreshResult =
  { ok: true; session: AuthSession } | { ok: false; reason: LogoutReason | null };

let refreshInFlight: Promise<RefreshResult> | null = null;

function reasonFromError(error: ApiError): LogoutReason | null {
  switch (error.detailReason) {
    case 'DEPOT_PENDING':
      return 'depot-pending';
    case 'DEPOT_REJECTED':
      return 'depot-rejected';
    case 'DEPOT_SUSPENDED':
      return 'depot-suspended';
    case 'NO_SESSION':
      return null;
    default:
      return 'session-expired';
  }
}

async function performRefresh(): Promise<RefreshResult> {
  let response: Response;

  try {
    response = await fetch(`${AUTH_BASE}/refresh`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    useSessionStore.getState().clearSession('service-unavailable');
    return { ok: false, reason: 'service-unavailable' };
  }

  if (!response.ok) {
    const error = await parseErrorResponse(response);
    const reason = reasonFromError(error);
    useSessionStore.getState().clearSession(reason);
    return { ok: false, reason };
  }

  const payload = (await response.json()) as RefreshPayload;
  useSessionStore.getState().setSession(payload.user, payload.depot, payload.accessToken);

  return {
    ok: true,
    session: {
      user: payload.user,
      depot: payload.depot,
      accessToken: payload.accessToken,
    },
  };
}

export function refreshAccessToken(): Promise<RefreshResult> {
  if (refreshInFlight === null) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

export async function loginWithPassword(
  identifier: string,
  password: string,
): Promise<AuthSession> {
  let response: Response;

  try {
    response = await fetch(`${AUTH_BASE}/login`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ identifier, password }),
      cache: 'no-store',
    });
  } catch {
    throw networkError();
  }

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  const payload = (await response.json()) as {
    accessToken: string;
    user: SessionUser;
    depot: SessionDepot | null;
  };

  useSessionStore.getState().setSession(payload.user, payload.depot, payload.accessToken);

  return {
    user: payload.user,
    depot: payload.depot,
    accessToken: payload.accessToken,
  };
}

export async function logoutSession(): Promise<void> {
  try {
    await fetch(`${AUTH_BASE}/logout`, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } finally {
    useSessionStore.getState().clearSession('logout');
  }
}
