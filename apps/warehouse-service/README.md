# warehouse-service

Owns warehouses and the storage locations inside them. It knows _where_ goods
can be kept, not what is kept there; that is inventory-service's job.

- **Port:** 4003 · **Database:** `ims_warehouse` · **API docs:** <http://localhost:4003/docs>
- **Health:** `GET /health` (checks the database)

## API

Reached from the frontend through the gateway under `/v1`.

| Method | Path                                     | Permission         | Description                          |
| ------ | ---------------------------------------- | ------------------ | ------------------------------------ |
| GET    | `/warehouses`                            | `warehouses:read`  | List (paginated, search, `isActive`) |
| GET    | `/warehouses/:id`                        | `warehouses:read`  | One warehouse                        |
| POST   | `/warehouses`                            | `warehouses:write` | Create a warehouse                   |
| PATCH  | `/warehouses/:id`                        | `warehouses:write` | Update; `isActive: true` restores    |
| DELETE | `/warehouses/:id`                        | `warehouses:write` | Archive (sets `isActive=false`)      |
| GET    | `/warehouses/:warehouseId/locations`     | `warehouses:read`  | List a warehouse's locations         |
| GET    | `/warehouses/:warehouseId/locations/:id` | `warehouses:read`  | One location                         |
| POST   | `/warehouses/:warehouseId/locations`     | `warehouses:write` | Add a location                       |
| PATCH  | `/warehouses/:warehouseId/locations/:id` | `warehouses:write` | Update a location                    |
| DELETE | `/warehouses/:warehouseId/locations/:id` | `warehouses:write` | Delete a location                    |

Staff can read; managers and admins can also write. `search` on warehouses
matches the code, name or city. List responses use the standard
`{ data, meta }` envelope.

## Data model

- **Warehouse code** (`WH-NYC`) is the business identifier: stored
  upper-cased, unique (`409 WAREHOUSE_CODE_TAKEN`).
- **Storage location code** (`A-01-03`, aisle-rack-shelf) is unique within its
  warehouse (`409 LOCATION_CODE_TAKEN`); two warehouses can both have an
  `A-01-03`.
- **Locations are nested under their warehouse in the URL,** and are only
  ever looked up through it. A location ID combined with the wrong warehouse
  ID returns `404`.
- **Warehouses are archived, not deleted,** because other services keep
  references to warehouse IDs. Storage locations are deleted for real.

## Configuration

See `.env.example`. Shared values come from the root `.env`.

| Variable            | Purpose                                                   |
| ------------------- | --------------------------------------------------------- |
| `PORT`, `DB_NAME`   | Service port and database                                 |
| `JWT_ACCESS_SECRET` | Verifies access tokens issued by auth-service             |
| `DB_MIGRATIONS_RUN` | Apply pending migrations at startup                       |
| `SEED_DATA`         | Insert sample warehouses and storage locations at startup |

## Seed data

With `SEED_DATA=true` (the local default) the service inserts 3 warehouses
(`WH-NYC`, `WH-LON`, `WH-BLR`), each with 4 storage locations
(`src/seed/seed-data.ts`), on first start. Seeding is idempotent and never
overwrites existing rows.

## Commands

```bash
pnpm nx serve warehouse-service      # run in watch mode
pnpm nx test warehouse-service       # unit tests (no infrastructure needed)
pnpm nx test-int warehouse-service   # integration tests (needs pnpm docker:up)
pnpm nx build warehouse-service      # production bundle in dist/apps/warehouse-service
```

Integration tests use their own database, `ims_warehouse_test`, created on demand.
