# api-gateway

The single entry point for the frontend. It owns no data and no business
rules; it protects and routes.

- **Port:** 4000 · **API docs:** <http://localhost:4000/docs>
- **Health:** `GET /health` (checks Redis)

## What it does for every request

1. **Correlation ID.** Reuses the caller's `x-correlation-id` or creates one,
   returns it on the response and forwards it downstream, so one request can
   be traced through every service's logs.
2. **Rate limiting.** Per client IP, counted in Redis so the limit holds
   across multiple gateway instances. Exceeding it returns `429`.
3. **Authentication.** Verifies the JWT access token. Requests without a valid
   token are rejected here and never reach a service.
4. **Routing.** Forwards `/v1/<resource>/...` to the service that owns the
   resource, with a timeout and (for GET) retries.

## Routing table

Defined in `src/proxy/routes.ts`. The `/v1` prefix is stripped when forwarding.

| Gateway path                                           | Forwarded to | Auth                      |
| ------------------------------------------------------ | ------------ | ------------------------- |
| `POST /v1/auth/login`, `register`, `refresh`, `logout` | auth-service | public, strict rate limit |
| `/v1/auth/*` (everything else, e.g. `GET /v1/auth/me`) | auth-service | access token              |
| `/v1/users/*`                                          | auth-service | access token              |

Later phases add one line per new resource.

## Design notes

- **Authorisation stays in the services.** The gateway authenticates; each
  service verifies the same token again and enforces its own permissions.
  A service is therefore safe even if called directly, and the gateway does
  not need to know every service's rules.
- **Only an allow-list of headers is forwarded** (`authorization`,
  `x-correlation-id`, `x-forwarded-for`, `content-type`). Cookies and other
  client headers stop at the gateway.
- **Timeouts on every call**, so a slow service cannot hang the gateway
  (`504 UPSTREAM_TIMEOUT`). A service that cannot be reached returns
  `503 UPSTREAM_UNAVAILABLE`.
- **Only idempotent requests are retried** (GET, with exponential backoff).
  A failed POST is never replayed, because it may already have been applied.
- **Upstream errors pass through unchanged**, so clients always see the
  service's own error code and message.
- **If Redis is down, requests fail** rather than bypassing the rate limit.

## Configuration

See `.env.example`. Shared values come from the root `.env`.

| Variable                    | Default | Purpose                          |
| --------------------------- | ------- | -------------------------------- |
| `PORT`                      | 4000    | Gateway port                     |
| `CORS_ORIGINS`              |         | Origins allowed to call the API  |
| `JWT_ACCESS_SECRET`         |         | Verifies access tokens           |
| `REDIS_URL`                 |         | Rate-limit counters              |
| `AUTH_SERVICE_URL`          |         | Base URL of auth-service         |
| `UPSTREAM_TIMEOUT_MS`       | 5000    | Timeout per downstream call      |
| `UPSTREAM_RETRIES`          | 2       | Extra attempts for GET requests  |
| `RATE_LIMIT_WINDOW_SECONDS` | 60      | Rate-limit window                |
| `RATE_LIMIT_MAX`            | 120     | Requests per window per IP       |
| `AUTH_RATE_LIMIT_MAX`       | 10      | Limit for the public auth routes |

## Commands

```bash
pnpm nx serve api-gateway      # run in watch mode
pnpm nx test api-gateway       # unit tests (no infrastructure needed)
pnpm nx test-int api-gateway   # integration tests (needs pnpm docker:up)
pnpm nx build api-gateway      # production bundle in dist/apps/api-gateway
```

Integration tests use Redis database 15 and a stub upstream server, so they do
not need auth-service running.

## Try it

```bash
curl -s -X POST http://localhost:4000/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@ims.local","password":"<SEED_USER_PASSWORD>"}'
```
