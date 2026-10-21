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
  updateUser: (patch: Partial<SessionUser>) => void;
  updateDepot: (patch: Partial<SessionDepot>) => void;
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
  updateUser: (patch) =>
    set((state) => (state.user === null ? {} : { user: { ...state.user, ...patch } })),
  updateDepot: (patch) =>
    set((state) => (state.depot === null ? {} : { depot: { ...state.depot, ...patch } })),
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
