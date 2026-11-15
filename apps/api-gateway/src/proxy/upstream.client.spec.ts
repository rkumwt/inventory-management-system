import {
  GatewayTimeoutException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { UpstreamClient, UpstreamRequest } from './upstream.client';

const client = new UpstreamClient({
  baseUrls: { auth: 'http://auth.internal:4001' },
  timeoutMs: 1000,
  retries: 2,
  retryDelayMs: 0,
});

const get: UpstreamRequest = {
  upstream: 'auth',
  method: 'GET',
  path: '/users?page=2',
  headers: { accept: 'application/json' },
};
const post: UpstreamRequest = { ...get, method: 'POST', body: '{"a":1}' };

const ok = (body = '{"ok":true}', status = 200) =>
  new Response(body, {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('UpstreamClient', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('calls the upstream URL with a timeout signal and returns the response', async () => {
    fetchMock.mockResolvedValueOnce(ok());

    const response = await client.send(get);

    expect(response).toEqual({
      status: 200,
      contentType: 'application/json',
      body: '{"ok":true}',
    });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://auth.internal:4001/users?page=2');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('passes upstream 4xx responses through without retrying', async () => {
    fetchMock.mockResolvedValueOnce(ok('{"error":"NOT_FOUND"}', 404));

    const response = await client.send(get);

    expect(response.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a GET after a network error and then succeeds', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(ok());

    await expect(client.send(get)).resolves.toMatchObject({ status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a GET on 503 and returns the last response when all fail', async () => {
    fetchMock.mockImplementation(async () => ok('busy', 503));

    await expect(client.send(get)).resolves.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('never retries a POST, because it may already have been applied', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(client.send(post)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports 503 UPSTREAM_UNAVAILABLE when the service cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(client.send(get)).rejects.toMatchObject({
      response: { error: 'UPSTREAM_UNAVAILABLE' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('reports 504 UPSTREAM_TIMEOUT when the service is too slow', async () => {
    fetchMock.mockRejectedValue(
      new DOMException('The operation timed out', 'TimeoutError'),
    );

    await expect(client.send(post)).rejects.toThrow(GatewayTimeoutException);
  });
});
