export interface RetryOptions {
  timeoutMs: number;
  /** Extra attempts after a failure. */
  retries: number;
  /** Base backoff; doubles on each retry. */
  retryDelayMs: number;
  /** Called before each retry, e.g. to log a warning. */
  onRetry?: (attempt: number, attempts: number, error: unknown) => void;
}

const RETRYABLE_STATUSES = new Set([502, 503, 504]);

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * `fetch` for synchronous service-to-service GETs: a timeout on every
 * attempt, and retries with exponential backoff when the service cannot be
 * reached or answers 502/503/504.
 *
 * Use it for idempotent requests only: a retried POST could be applied twice.
 * Resolves with the response (any status) or rejects with the last error.
 */
export async function fetchWithRetry(
  url: string,
  init: { headers?: Record<string, string> },
  options: RetryOptions,
): Promise<Response> {
  const attempts = 1 + options.retries;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const isLastAttempt = attempt === attempts;
    try {
      const response = await fetch(url, {
        headers: init.headers,
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      if (!RETRYABLE_STATUSES.has(response.status) || isLastAttempt) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    if (!isLastAttempt) {
      options.onRetry?.(attempt, attempts, lastError);
      await sleep(options.retryDelayMs * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}
