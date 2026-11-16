# web

The frontend: a Next.js (App Router) single-page-style app for managing
products, warehouses, stock and orders.

- **URL:** <http://localhost:3001> (port 3000 is left free for other projects)
- **Talks to:** the API gateway only (`NEXT_PUBLIC_API_URL`), never to a
  service directly.

Sign in with a seed user (see
[auth-service](../auth-service/README.md#seed-users)).

## Screens

| Path               | What it shows                                                    | Needs                |
| ------------------ | ---------------------------------------------------------------- | -------------------- |
| `/login`           | Email and password sign-in                                       | nothing              |
| `/dashboard`       | Counts, low-stock items, recent orders                           | signed in            |
| `/products`        | Search, filter by category, paginate; create, edit, archive      | `products:read`      |
| `/warehouses`      | Search and paginate; create, edit, archive                       | `warehouses:read`    |
| `/warehouses/[id]` | One warehouse and its storage locations                          | `warehouses:read`    |
| `/inventory`       | Stock levels and movement history; stock in, stock out, transfer | `inventory:read`     |
| `/orders`          | Search and filter by status; place an order                      | `orders:read`        |
| `/orders/[id]`     | Items, live status, cancel                                       | `orders:read`        |
| `/notifications`   | Emails sent in response to events                                | `notifications:read` |

Write actions (New product, Stock in, Transfer, Cancel order, ...) are shown
only to users whose permissions allow them.

## Structure

Code is grouped by feature, not by file type:

```
src/
  app/                    routes only: each page file renders a feature component
    login/
    (app)/                everything behind sign-in; layout.tsx is the route guard
  features/
    auth/                 session, auth context, login form
    products/             api.ts (queries + mutations), schema, components
    warehouses/
    inventory/
    orders/
    notifications/
    dashboard/
  components/
    ui/                   shadcn/ui-style primitives (button, input, dialog, table, ...)
    app-shell.tsx         sidebar + layout
    navigation.ts         menu entries and the permission each needs
    data-states.tsx       loading / error / empty states for tables
  lib/
    api/client.ts         the typed API client
    api/types.ts          the API contract as the frontend sees it
    env.ts                Zod-validated environment
```

A feature may import from `components/`, `lib/` and another feature's
`api.ts`; `components/` and `lib/` never import from a feature.

## How it works

### API client (`src/lib/api/client.ts`)

One small client that every feature goes through:

- Sends the access token as a `Bearer` header.
- On a `401`, exchanges the refresh token for a new pair and repeats the
  request once. Requests that fail at the same moment share **one** refresh:
  refresh tokens are single-use, and a second exchange would make
  auth-service revoke the session as suspected theft.
- Turns every failure into an `ApiError` carrying the service's own error
  code and message, which the UI shows in a toast or inline.

### Session

- The **access token** lives in memory only. The **refresh token** is kept in
  `localStorage` so a page reload can restore the session.
- The user's permissions are read from the access token's claims, so the UI
  and the API always agree on what a role may do.
- `(app)/layout.tsx` redirects signed-out visitors to `/login` and shows a
  "No access" message for a page the user's role does not include.

The UI checks are for usability. The security boundary is the API: every
service verifies the token and its permissions on every request.

### Server state: TanStack Query

Each feature's `api.ts` exports hooks (`useProducts`, `useCreateOrder`, ...).
Lists keep showing the previous page while the next one loads, mutations
invalidate the lists they affect, and 4xx errors are not retried.

An order is `PENDING` when placed and settles asynchronously, so the order
queries **poll every 1.5 seconds while an order is pending** and stop once it
is confirmed or cancelled.

### Forms: React Hook Form + Zod

Every form has a Zod schema next to it. Validation messages appear under the
field; server errors (e.g. `SKU_ALREADY_EXISTS`) appear as a toast.

### UI states

Every table goes through `TableStates`, so loading (skeleton rows), error
(message with a retry button) and empty (explanation of what to do next) look
and behave the same everywhere.

## Configuration

| Variable              | Purpose                                                   |
| --------------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | Gateway base URL including `/v1`. Validated at build time |

`NEXT_PUBLIC_` values are embedded in the browser bundle; never put a secret
there. The gateway must list this app's origin in `CORS_ORIGINS` (root
`.env`).

## Commands

```bash
pnpm nx serve web       # dev server on http://localhost:3001
pnpm nx test web        # unit tests: API client, session, form schemas
pnpm nx build web       # production build (.next, standalone output)
pnpm nx start web       # serve the production build
```
