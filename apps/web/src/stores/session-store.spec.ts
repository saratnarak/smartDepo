import type { SessionUser } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';

const USER: SessionUser = {
  id: 'user-1',
  name: 'Owner',
  email: 'owner@example.com',
  phone: '012345678',
  role: 'OWNER',
  depotId: 'depot-1',
  mustChangePassword: false,
};

const DEPOT = { id: 'depot-1', name: 'Depot A', status: 'APPROVED' as const };

describe('session store', () => {
  beforeEach(() => {
    useSessionStore.setState({
      user: null,
      role: null,
      depot: null,
      accessToken: null,
      status: 'loading',
      logoutReason: null,
    });
  });

  it('stores an authenticated session without persisting the access token', () => {
    useSessionStore.getState().setSession(USER, DEPOT, 'access-token');

    const state = useSessionStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.user).toEqual(USER);
    expect(state.role).toBe('OWNER');
    expect(state.depot).toEqual(DEPOT);
    expect(state.accessToken).toBe('access-token');
  });

  it('updates only the access token after a refresh', () => {
    useSessionStore.getState().setSession(USER, DEPOT, 'old-token');
    useSessionStore.getState().setAccessToken('new-token');

    expect(useSessionStore.getState().accessToken).toBe('new-token');
    expect(useSessionStore.getState().user).toEqual(USER);
  });

  it('patches the current user and depot without replacing the session', () => {
    useSessionStore.getState().setSession(USER, DEPOT, 'access-token');
    useSessionStore.getState().updateUser({ mustChangePassword: true });
    useSessionStore.getState().updateDepot({ name: 'Depot B' });

    const state = useSessionStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.accessToken).toBe('access-token');
    expect(state.user?.mustChangePassword).toBe(true);
    expect(state.depot?.name).toBe('Depot B');
  });

  it('clears the session and records the logout reason', () => {
    useSessionStore.getState().setSession(USER, DEPOT, 'access-token');
    useSessionStore.getState().clearSession('depot-suspended');

    const state = useSessionStore.getState();
    expect(state.status).toBe('anonymous');
    expect(state.user).toBeNull();
    expect(state.role).toBeNull();
    expect(state.depot).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.logoutReason).toBe('depot-suspended');
  });
});
