import {
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CatalogClient } from './catalog.client';

const client = new CatalogClient({
  productServiceUrl: 'http://product.internal:4002',
  warehouseServiceUrl: 'http://warehouse.internal:4003',
  timeoutMs: 1000,
  retries: 2,
  retryDelayMs: 0,
});

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('CatalogClient', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it("asks the owning service, passing the caller's token along", async () => {
    fetchMock.mockResolvedValue(json({ id: 'p1', isActive: true }));

    await client.assertProductUsable('p1', 'Bearer abc');

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://product.internal:4002/products/p1');
    expect(init?.headers).toMatchObject({ authorization: 'Bearer abc' });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('rejects an ID the owning service does not know', async () => {
    fetchMock.mockResolvedValue(json({ error: 'NOT_FOUND' }, 404));

    const attempt = client.assertWarehouseUsable('w9', 'Bearer abc');

    await expect(attempt).rejects.toThrow(BadRequestException);
    await expect(attempt).rejects.toMatchObject({
      response: { error: 'WAREHOUSE_NOT_FOUND' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1); // a 404 is an answer, not a failure
  });

  it('rejects an archived product', async () => {
    fetchMock.mockResolvedValue(json({ id: 'p1', isActive: false }));

    await expect(
      client.assertProductUsable('p1', 'Bearer abc'),
    ).rejects.toMatchObject({ response: { error: 'PRODUCT_ARCHIVED' } });
  });

  it('retries a failed lookup and succeeds once the service answers', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json({ id: 'p1', isActive: true }));

    await expect(
      client.assertProductUsable('p1', 'Bearer abc'),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('fails closed with 503 when the service stays unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const attempt = client.assertProductUsable('p1', 'Bearer abc');

    await expect(attempt).rejects.toThrow(ServiceUnavailableException);
    await expect(attempt).rejects.toMatchObject({
      response: { error: 'CATALOG_UNAVAILABLE' },
    });
  });

  it('treats an unexpected answer (e.g. 403) as unavailable, not as valid', async () => {
    fetchMock.mockResolvedValue(json({ error: 'FORBIDDEN' }, 403));

    await expect(
      client.assertProductUsable('p1', 'Bearer abc'),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
