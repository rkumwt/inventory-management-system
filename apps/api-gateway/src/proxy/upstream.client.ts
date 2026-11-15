import {
  GatewayTimeoutException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { UpstreamName } from './routes';

export const UPSTREAM_OPTIONS = Symbol('UPSTREAM_OPTIONS');

export interface UpstreamOptions {
  baseUrls: Record<UpstreamName, string>;
  timeoutMs: number;
  /** Extra attempts for idempotent requests. */
  retries: number;
  /** Base backoff; doubles on each retry. */
  retryDelayMs: number;
}

export interface UpstreamRequest {
  upstream: UpstreamName;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
}

export interface UpstreamResponse {
  status: number;
  contentType: string | null;
  body: string;
}

const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD']);
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * HTTP client for synchronous calls to downstream services.
 *
 * - Every call has a timeout, so a slow service cannot hang the gateway.
 * - Only idempotent requests (GET/HEAD) are retried, with exponential
 *   backoff. A failed POST is never replayed: it may have been applied.
 * - Upstream HTTP errors (4xx/5xx) are passed through untouched; only
 *   "could not reach the service" becomes a gateway error (503/504).
 */
@Injectable()
export class UpstreamClient {
  private readonly logger = new Logger(UpstreamClient.name);

  constructor(
    @Inject(UPSTREAM_OPTIONS) private readonly options: UpstreamOptions,
  ) {}

  async send(request: UpstreamRequest): Promise<UpstreamResponse> {
    const url = `${this.options.baseUrls[request.upstream]}${request.path}`;
    const method = request.method.toUpperCase();
    const attempts = IDEMPOTENT_METHODS.has(method)
      ? 1 + this.options.retries
      : 1;

    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const isLastAttempt = attempt === attempts;
      try {
        const response = await fetch(url, {
          method,
          headers: request.headers,
          body: request.body,
          signal: AbortSignal.timeout(this.options.timeoutMs),
        });

        if (!RETRYABLE_STATUSES.has(response.status) || isLastAttempt) {
          return {
            status: response.status,
            contentType: response.headers.get('content-type'),
            body: await response.text(),
          };
        }
        lastError = new Error(`HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
      }

      if (!isLastAttempt) {
        this.logger.warn(
          `${method} ${request.upstream}${request.path} failed (attempt ${attempt}/${attempts}): ${describe(lastError)}`,
        );
        await sleep(this.options.retryDelayMs * 2 ** (attempt - 1));
      }
    }

    this.logger.error(
      `${method} ${request.upstream}${request.path} unavailable: ${describe(lastError)}`,
    );
    if (isTimeout(lastError)) {
      throw new GatewayTimeoutException({
        error: 'UPSTREAM_TIMEOUT',
        message: `The ${request.upstream} service did not respond in time`,
      });
    }
    throw new ServiceUnavailableException({
      error: 'UPSTREAM_UNAVAILABLE',
      message: `The ${request.upstream} service is currently unavailable`,
    });
  }
}

function isTimeout(error: unknown): boolean {
  // AbortSignal.timeout() rejects with a DOMException named "TimeoutError".
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'TimeoutError'
  );
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
