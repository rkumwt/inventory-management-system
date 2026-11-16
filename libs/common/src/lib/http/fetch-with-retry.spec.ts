import { fetchWithRetry } from './fetch-with-retry';

const options = { timeoutMs: 1000, retries: 2, retryDelayMs: 0 };
const ok = (status = 200) => new Response('{}', { status });

describe('fetchWithRetry', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => jest.restoreAllMocks());

  it('returns the first good answer, with a timeout signal attached', async () => {
    fetchMock.mockResolvedValue(ok());

    const response = await fetchWithRetry('http://svc/x', {}, options);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not retry client errors: a 404 is an answer', async () => {
    fetchMock.mockResolvedValue(ok(404));

    const response = await fetchWithRetry('http://svc/x', {}, options);

    expect(response.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries network errors and 503s, reporting each retry', async () => {
    const onRetry = jest.fn();
    fetchMock
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(ok(503))
      .mockResolvedValueOnce(ok());

    const response = await fetchWithRetry(
      'http://svc/x',
      {},
      { ...options, onRetry },
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('rejects with the last error once attempts run out', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(fetchWithRetry('http://svc/x', {}, options)).rejects.toThrow(
      'ECONNREFUSED',
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('hands back a 503 on the final attempt instead of throwing', async () => {
    fetchMock.mockResolvedValue(ok(503));

    const response = await fetchWithRetry('http://svc/x', {}, options);

    expect(response.status).toBe(503);
  });
});
