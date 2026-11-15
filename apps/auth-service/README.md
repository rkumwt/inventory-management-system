# auth-service

Owns users and sessions. Issues the JWT access tokens every other service
verifies, and the refresh tokens used to obtain new ones.

- **Port:** 4001 · **Database:** `ims_auth` · **API docs:** <http://localhost:4001/docs>
- **Health:** `GET /health` (checks the database)

## API

Reached from the frontend through the gateway under `/v1`.

| Method | Path              | Auth           | Description                                 |
| ------ | ----------------- | -------------- | ------------------------------------------- |
| POST   | `/auth/register`  | public         | Create an account (always role `STAFF`)     |
| POST   | `/auth/login`     | public         | Email + password for an access/refresh pair |
| POST   | `/auth/refresh`   | public         | Rotate a refresh token for a new pair       |
| POST   | `/auth/logout`    | public         | Revoke a refresh token (idempotent)         |
| GET    | `/auth/me`        | access token   | The current user                            |
| GET    | `/users`          | `users:manage` | List users (paginated, searchable)          |
| PATCH  | `/users/:id/role` | `users:manage` | Change a user's role                        |

## How tokens work

| Token   | Lifetime | Format                                    | Stored server-side |
| ------- | -------- | ----------------------------------------- | ------------------ |
| Access  | 15 min   | JWT (HS256): user, role, permissions      | No (stateless)     |
| Refresh | 7 days   | JWT (HS256, separate secret) with a `jti` | SHA-256 hash only  |

- **Access tokens are stateless.** Any service can verify one with the shared
  secret, with no call back to auth-service. The trade-off is that a token
  stays valid until it expires, which is why the lifetime is short.
- **Refresh tokens rotate.** Each one works exactly once; using it returns a
  new pair and revokes the old token.
- **Reuse is treated as theft.** If a refresh token that was already used or
  logged out is presented again, every session of that user is revoked
  (`REFRESH_TOKEN_REVOKED`) and they must sign in again.
- **Only hashes are stored.** A database leak does not expose usable refresh
  tokens. Passwords are hashed with Argon2id.
- **Login errors are generic.** Wrong password, unknown email and deactivated
  account all return the same `INVALID_CREDENTIALS`, so the API cannot be used
  to discover which emails are registered.

## Roles and permissions

Roles map to permissions in `libs/common` (`ROLE_PERMISSIONS`). The permissions
are embedded in the access token at login; guards check permissions, never
roles. A role change takes effect at the user's next login or refresh.

## Configuration

See `.env.example`. Shared values come from the root `.env`.

| Variable                          | Purpose                                              |
| --------------------------------- | ---------------------------------------------------- |
| `PORT`, `DB_NAME`                 | Service port and database                            |
| `JWT_ACCESS_SECRET`               | Signs access tokens (shared with verifying services) |
| `JWT_REFRESH_SECRET`              | Signs refresh tokens (auth-service only)             |
| `JWT_*_TTL_SECONDS`               | Token lifetimes                                      |
| `DB_MIGRATIONS_RUN`               | Apply pending migrations at startup                  |
| `SEED_DATA`, `SEED_USER_PASSWORD` | Create one sample user per role at startup           |

## Seed users

With `SEED_DATA=true` (the local default) these users exist after first start.
They all use the password in `SEED_USER_PASSWORD` in `apps/auth-service/.env`.

| Email               | Role    |
| ------------------- | ------- |
| `admin@ims.local`   | ADMIN   |
| `manager@ims.local` | MANAGER |
| `staff@ims.local`   | STAFF   |

## Commands

```bash
pnpm nx serve auth-service      # run in watch mode
pnpm nx test auth-service       # unit tests (no infrastructure needed)
pnpm nx test-int auth-service   # integration tests (needs pnpm docker:up)
pnpm nx build auth-service      # production bundle in dist/apps/auth-service
```

Integration tests use their own database, `ims_auth_test`, created on demand.

## Migrations

Hand-written SQL migrations live in `src/database/migrations` and are listed
explicitly in `index.ts`. Add a new class there and append it to the array.
