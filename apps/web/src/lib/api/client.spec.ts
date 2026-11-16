import { ApiError, createApiClient } from './client';
import type { AuthTokens } from './types';

const tokens = (n: number): AuthTokens => ({
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  tokenType: 'Bearer',
  expiresIn: 900,
  user: { id: 'u1', email: 'a@b.co', name: 'A', role: 'STAFF', isActive: true },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function setup() {
  const store = new Map<string, string>();
  const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();
  const client = createApiClient({
    baseUrl: 'http://gateway/v1',
    fetch: fetchMock as unknown as typeof fetch,
    storage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => void store.set(key, value),
      removeItem: (key) => void store.delete(key),
    },
  });
  const header = (call: number, name: string) =>
    (fetchMock.mock.calls[call]?.[1].headers as Record<string, string>)[name];
  return { client, fetchMock, store, header };
}

describe('API client', () => {
  it('builds the URL from the gateway base, skipping empty query values', async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValue(json({ data: [] }));

    await client.get('/products', {
      page: 2,
      search: '',
      categoryId: undefined,
      isActive: true,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://gateway/v1/products?page=2&isActive=true',
    );
  });

  it('keeps the refresh token after login and sends the access token as Bearer', async () => {
    const { client, fetchMock, store, header } = setup();
    fetchMock
      .mockResolvedValueOnce(json(tokens(1)))
      .mockResolvedValueOnce(json({ ok: true }));

    await client.login('a@b.co', 'secret');
    await client.get('/products');

    expect(store.get('ims.refreshToken')).toBe('refresh-1');
    expect(header(0, 'authorization')).toBeUndefined();
    expect(header(1, 'authorization')).toBe('Bearer access-1');
  });

  it('turns an error response into an ApiError with the service error code', async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValue(
      json(
        {
          statusCode: 409,
          error: 'SKU_ALREADY_EXISTS',
          message: 'A product with SKU X already exists',
          correlationId: 'corr-1',
        },
        409,
      ),
    );

    await expect(client.post('/products', {})).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      code: 'SKU_ALREADY_EXISTS',
      correlationId: 'corr-1',
    });
  });

  it('reports a network failure as a readable error', async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(client.get('/products')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    });
  });

  it('returns undefined for 204 No Content', async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(client.delete('/products/1')).resolves.toBeUndefined();
  });

  describe('expired access token', () => {
    it('refreshes once and repeats the request with the new token', async () => {
      const { client, fetchMock, store, header } = setup();
      store.set('ims.refreshToken', 'refresh-1');
      fetchMock
        .mockResolvedValueOnce(json({ error: 'UNAUTHORIZED' }, 401))
        .mockResolvedValueOnce(json(tokens(2)))
        .mockResolvedValueOnce(json({ id: 'p1' }));

      await expect(client.get('/products/p1')).resolves.toEqual({ id: 'p1' });

      expect(fetchMock.mock.calls[1]?.[0]).toBe(
        'http://gateway/v1/auth/refresh',
      );
      expect(header(2, 'authorization')).toBe('Bearer access-2');
      expect(store.get('ims.refreshToken')).toBe('refresh-2');
    });

    it('shares one refresh between requests that fail at the same time', async () => {
      const { client, fetchMock, store } = setup();
      store.set('ims.refreshToken', 'refresh-1');
      fetchMock.mockImplementation(async (url, init) => {
        if (url.endsWith('/auth/refresh')) return json(tokens(2));
        const authorization = (init.headers as Record<string, string>)[
          'authorization'
        ];
        return authorization === 'Bearer access-2'
          ? json({ ok: true })
          : json({ error: 'UNAUTHORIZED' }, 401);
      });

      await Promise.all([
        client.get('/products'),
        client.get('/warehouses'),
        client.get('/orders'),
      ]);

      const refreshCalls = fetchMock.mock.calls.filter(([url]) =>
        url.endsWith('/auth/refresh'),
      );
      // A refresh token is single-use: a second exchange would revoke the session.
      expect(refreshCalls).toHaveLength(1);
    });

    it('signs out when the refresh token is rejected', async () => {
      const { client, fetchMock, store } = setup();
      const expired = jest.fn();
      client.onSessionExpired(expired);
      store.set('ims.refreshToken', 'refresh-1');
      fetchMock
        .mockResolvedValueOnce(json({ error: 'UNAUTHORIZED' }, 401))
        .mockResolvedValueOnce(json({ error: 'REFRESH_TOKEN_REVOKED' }, 401));

      await expect(client.get('/products')).rejects.toBeInstanceOf(ApiError);

      expect(expired).toHaveBeenCalledTimes(1);
      expect(store.has('ims.refreshToken')).toBe(false);
    });

    it('keeps the session when the refresh fails only because the server is down', async () => {
      const { client, fetchMock, store } = setup();
      const expired = jest.fn();
      client.onSessionExpired(expired);
      store.set('ims.refreshToken', 'refresh-1');
      fetchMock
        .mockResolvedValueOnce(json({ error: 'UNAUTHORIZED' }, 401))
        .mockResolvedValueOnce(json({ error: 'UPSTREAM_UNAVAILABLE' }, 503));

      await expect(client.get('/products')).rejects.toMatchObject({
        status: 503,
      });

      expect(expired).not.toHaveBeenCalled();
      expect(store.get('ims.refreshToken')).toBe('refresh-1');
    });

    it('does not try to refresh a failed login', async () => {
      const { client, fetchMock } = setup();
      fetchMock.mockResolvedValue(json({ error: 'INVALID_CREDENTIALS' }, 401));

      await expect(client.login('a@b.co', 'wrong')).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('session', () => {
    it('restores a session from a stored refresh token', async () => {
      const { client, fetchMock, store } = setup();
      store.set('ims.refreshToken', 'refresh-1');
      fetchMock.mockResolvedValue(json(tokens(2)));

      await expect(client.restoreSession()).resolves.toMatchObject({
        accessToken: 'access-2',
      });
    });

    it('restores nothing, and calls nothing, without a stored token', async () => {
      const { client, fetchMock } = setup();

      await expect(client.restoreSession()).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('logout revokes the refresh token and forgets both tokens', async () => {
      const { client, fetchMock, store, header } = setup();
      fetchMock
        .mockResolvedValueOnce(json(tokens(1)))
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockResolvedValueOnce(json({ ok: true }));
      await client.login('a@b.co', 'secret');

      await client.logout();
      await client.get('/products');

      expect(fetchMock.mock.calls[1]?.[0]).toBe(
        'http://gateway/v1/auth/logout',
      );
      expect(fetchMock.mock.calls[1]?.[1].body).toBe(
        JSON.stringify({ refreshToken: 'refresh-1' }),
      );
      expect(store.has('ims.refreshToken')).toBe(false);
      expect(header(2, 'authorization')).toBeUndefined();
    });
  });
});
