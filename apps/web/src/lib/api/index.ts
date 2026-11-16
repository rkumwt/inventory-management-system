import { env } from '../env';
import { createApiClient, type TokenStorage } from './client';

/** localStorage in the browser; a no-op while Next.js renders on the server. */
const storage: TokenStorage =
  typeof window === 'undefined'
    ? {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      }
    : window.localStorage;

/** The app-wide API client, pointed at the gateway. */
export const api = createApiClient({
  baseUrl: env.NEXT_PUBLIC_API_URL,
  fetch: (input, init) => fetch(input, init),
  storage,
});

export { ApiError } from './client';
export type * from './types';
