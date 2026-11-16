/** Downstream services the gateway can forward to. */
export type UpstreamName = 'auth' | 'product' | 'warehouse';

/**
 * Routing table: first path segment after `/v1` -> owning service.
 * `/v1/users/42` is forwarded to auth-service as `/users/42`.
 */
export const ROUTES: Readonly<Record<string, UpstreamName>> = {
  auth: 'auth',
  users: 'auth',
  categories: 'product',
  products: 'product',
  // Includes storage locations: /warehouses/:id/locations
  warehouses: 'warehouse',
};

export const API_PREFIX = 'v1';

export interface ResolvedRoute {
  upstream: UpstreamName;
  /** Path and query string to request on the upstream service. */
  path: string;
}

/** Maps an incoming gateway URL to an upstream, or `undefined` if unknown. */
export function resolveRoute(originalUrl: string): ResolvedRoute | undefined {
  const prefix = `/${API_PREFIX}/`;
  if (!originalUrl.startsWith(prefix)) return undefined;

  const path = originalUrl.slice(prefix.length - 1); // keep the leading slash
  const segment = path.split(/[/?]/)[1] ?? '';
  const upstream = ROUTES[segment];
  return upstream ? { upstream, path } : undefined;
}
