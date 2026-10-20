'use client';

import { create } from 'zustand';

import type { LogoutReason, SessionDepot, SessionUser, UserRole } from '@/lib/types';

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

interface SessionState {
  user: SessionUser | null;
  role: UserRole | null;
  depot: SessionDepot | null;
  accessToken: string | null;
  status: SessionStatus;
  logoutReason: LogoutReason | null;
  setSession: (user: SessionUser, depot: SessionDepot | null, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: (reason?: LogoutReason | null) => void;
  setLoading: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  role: null,
  depot: null,
  accessToken: null,
  status: 'loading',
  logoutReason: null,
  setSession: (user, depot, accessToken) =>
    set({
      user,
      role: user.role,
      depot,
      accessToken,
      status: 'authenticated',
      logoutReason: null,
    }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clearSession: (reason = null) =>
    set({
      user: null,
      role: null,
      depot: null,
      accessToken: null,
      status: 'anonymous',
      logoutReason: reason,
    }),
  setLoading: () => set({ status: 'loading' }),
}));

export function getAccessToken(): string | null {
  return useSessionStore.getState().accessToken;
}
