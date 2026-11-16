import type { AuthTokens, ErrorBody } from './types';

/** Any failed API call. `code` is the stable machine-readable error code. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
  /** Set to false for the public auth endpoints. */
  auth?: boolean;
}

export interface TokenStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ApiClientConfig {
  baseUrl: string;
  fetch: typeof fetch;
  /** Where the refresh token survives a page reload. */
  storage: TokenStorage;
}

const REFRESH_TOKEN_KEY = 'ims.refreshToken';

/**
 * The one place the frontend talks HTTP. Every feature's API functions go
 * through an instance of this, so the cross-cutting rules live here:
 *
 * - Base URL is the API gateway; the frontend never calls a service directly.
 * - The access token is kept in memory only and sent as a Bearer header.
 * - On a 401 the client exchanges the refresh token for a new pair and
 *   repeats the request once. Concurrent 401s share one refresh, because a
 *   refresh token is single-use: a second exchange of the same token would
 *   be treated as theft by auth-service and revoke the whole session.
 * - Failures become an `ApiError` carrying the service's own error code.
 */
export function createApiClient(config: ApiClientConfig) {
  let accessToken: string | null = null;
  let refreshing: Promise<AuthTokens> | null = null;
  let onSessionExpired: (() => void) | undefined;

  function storeTokens(tokens: AuthTokens): void {
    accessToken = tokens.accessToken;
    config.storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }

  function clearTokens(): void {
    accessToken = null;
    config.storage.removeItem(REFRESH_TOKEN_KEY);
  }

  function buildUrl(path: string, query?: RequestOptions['query']): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    }
    const search = params.toString();
    return `${config.baseUrl}${path}${search ? `?${search}` : ''}`;
  }

  async function send(
    method: string,
    path: string,
    options: RequestOptions,
  ): Promise<Response> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (options.body !== undefined)
      headers['content-type'] = 'application/json';
    if (options.auth !== false && accessToken) {
      headers['authorization'] = `Bearer ${accessToken}`;
    }

    try {
      return await config.fetch(buildUrl(path, options.query), {
        method,
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch {
      throw new ApiError(
        0,
        'NETWORK_ERROR',
        'Cannot reach the server. Check your connection and try again.',
      );
    }
  }

  async function toError(response: Response): Promise<ApiError> {
    let body: Partial<ErrorBody> = {};
    try {
      body = (await response.json()) as Partial<ErrorBody>;
    } catch {
      // Not JSON (e.g. a proxy error page): fall through to the defaults.
    }
    return new ApiError(
      response.status,
      body.error ?? 'UNKNOWN_ERROR',
      body.message ?? `Request failed (${response.status})`,
      body.details,
      body.correlationId,
    );
  }

  /** Exchanges the stored refresh token. Concurrent callers share one call. */
  function refresh(): Promise<AuthTokens> {
    refreshing ??= (async () => {
      const refreshToken = config.storage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Not signed in');
      }
      const response = await send('POST', '/auth/refresh', {
        body: { refreshToken },
        auth: false,
      });
      if (!response.ok) {
        const error = await toError(response);
        // A network blip (status 0 never reaches here) or a 5xx should not
        // sign the user out; only a rejected token does.
        if (response.status < 500) clearTokens();
        throw error;
      }
      const tokens = (await response.json()) as AuthTokens;
      storeTokens(tokens);
      return tokens;
    })().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    let response = await send(method, path, options);

    if (response.status === 401 && options.auth !== false) {
      try {
        await refresh();
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.status !== 0 &&
          error.status < 500
        ) {
          onSessionExpired?.();
        }
        throw error;
      }
      response = await send(method, path, options);
    }

    if (!response.ok) throw await toError(response);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  return {
    get: <T>(path: string, query?: RequestOptions['query']) =>
      request<T>('GET', path, { query }),
    post: <T>(path: string, body?: unknown) =>
      request<T>('POST', path, { body: body ?? {} }),
    patch: <T>(path: string, body: unknown) =>
      request<T>('PATCH', path, { body }),
    delete: <T = void>(path: string) => request<T>('DELETE', path),

    async login(email: string, password: string): Promise<AuthTokens> {
      const tokens = await request<AuthTokens>('POST', '/auth/login', {
        body: { email, password },
        auth: false,
      });
      storeTokens(tokens);
      return tokens;
    },

    /** Revokes the refresh token server-side, then forgets both tokens. */
    async logout(): Promise<void> {
      const refreshToken = config.storage.getItem(REFRESH_TOKEN_KEY);
      clearTokens();
      if (!refreshToken) return;
      try {
        await request('POST', '/auth/logout', {
          body: { refreshToken },
          auth: false,
        });
      } catch {
        // Already signed out locally; the token will expire on its own.
      }
    },

    /** On page load: turns a stored refresh token back into a session. */
    async restoreSession(): Promise<AuthTokens | null> {
      if (!config.storage.getItem(REFRESH_TOKEN_KEY)) return null;
      try {
        return await refresh();
      } catch {
        return null;
      }
    },

    /** Called when the session cannot be renewed and the user must sign in. */
    onSessionExpired(handler: () => void): void {
      onSessionExpired = handler;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
