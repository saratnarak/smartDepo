import { apiRequest, registerDepot } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { refreshAccessToken } from '@/lib/session-client';
import type { SessionUser } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';

jest.mock('@/lib/session-client', () => ({
  refreshAccessToken: jest.fn(),
}));

const refreshMock = refreshAccessToken as jest.MockedFunction<typeof refreshAccessToken>;
const fetchMock = jest.fn();
const USER: SessionUser = {
  id: 'user-1',
  name: 'Owner',
  email: 'owner@example.com',
  phone: '012345678',
  role: 'OWNER',
  depotId: 'depot-1',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('apiRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
    useSessionStore.setState({
      user: null,
      role: null,
      depot: null,
      accessToken: null,
      status: 'loading',
      logoutReason: null,
    });
  });

  it('attaches the in-memory access token and uses the /api/v1 base path', async () => {
    useSessionStore.getState().setSession(USER, null, 'memory-token');
    fetchMock.mockResolvedValue(jsonResponse({ data: 'ok' }));

    await expect(apiRequest<{ data: string }>('/example')).resolves.toEqual({ data: 'ok' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe('/api/v1/example');
    expect(headers.authorization).toBe('Bearer memory-token');
  });

  it('does not attach a token to public requests', async () => {
    useSessionStore.getState().setSession(USER, null, 'memory-token');
    fetchMock.mockResolvedValue(jsonResponse({ depot: { id: 'd1' }, owner: { id: 'u1' } }));

    await registerDepot({
      depotName: 'Depot',
      ownerName: 'Owner',
      phone: '012345678',
      email: 'owner@example.com',
      password: 'Password1',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });

  it('refreshes once after a 401 and retries with the new token', async () => {
    useSessionStore.getState().setSession(USER, null, 'expired-token');
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: 'Invalid credentials' }, 401))
      .mockResolvedValueOnce(jsonResponse({ data: 'retried' }));
    refreshMock.mockImplementation(async () => {
      useSessionStore.getState().setAccessToken('new-token');
      return {
        ok: true,
        session: { user: USER, depot: null, accessToken: 'new-token' },
      };
    });

    await expect(apiRequest<{ data: string }>('/secure')).resolves.toEqual({ data: 'retried' });
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const headers = secondInit.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer new-token');
  });

  it('throws the original API error when refresh fails', async () => {
    useSessionStore.getState().setSession(USER, null, 'expired-token');
    fetchMock.mockResolvedValue(jsonResponse({ message: 'Invalid credentials' }, 401));
    refreshMock.mockResolvedValue({ ok: false, reason: 'session-expired' });

    await expect(apiRequest('/secure')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('normalises validation details and network failures', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          statusCode: 400,
          error: 'Bad Request',
          message: 'Validation failed',
          details: ['email must be an email'],
        },
        400,
      ),
    );

    await expect(
      apiRequest('/auth/register', { method: 'POST', auth: false }),
    ).rejects.toMatchObject({
      status: 400,
      fieldErrors: ['email must be an email'],
    });

    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(apiRequest('/offline')).rejects.toEqual(
      expect.objectContaining({ status: 0, code: 'NETWORK_ERROR' }),
    );
  });

  it('exposes the server reason for blocked depot sessions', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid credentials',
          details: { reason: 'DEPOT_SUSPENDED' },
        },
        401,
      ),
    );
    refreshMock.mockResolvedValue({ ok: false, reason: 'depot-suspended' });

    try {
      await apiRequest('/secure');
      throw new Error('Expected apiRequest to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).detailReason).toBe('DEPOT_SUSPENDED');
    }
  });
});
