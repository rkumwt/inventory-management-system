# inventory-service

Owns stock: how many units of each product are in each warehouse, and the
full history of how that number changed.

- **Port:** 4004 · **Database:** `ims_inventory` · **API docs:** <http://localhost:4004/docs>
- **Health:** `GET /health` (checks the database)

## API

Reached from the frontend through the gateway under `/v1`.

| Method | Path                       | Permission           | Description                                                                  |
| ------ | -------------------------- | -------------------- | ---------------------------------------------------------------------------- |
| GET    | `/inventory`               | `inventory:read`     | Stock levels; filter by `productId`, `warehouseId`, `lowStock`               |
| GET    | `/inventory/movements`     | `inventory:read`     | Movement history, newest first; filter by `productId`, `warehouseId`, `type` |
| GET    | `/inventory/:id`           | `inventory:read`     | One stock item                                                               |
| POST   | `/inventory/stock-in`      | `inventory:adjust`   | Receive stock                                                                |
| POST   | `/inventory/stock-out`     | `inventory:adjust`   | Remove available stock                                                       |
| POST   | `/inventory/transfer`      | `inventory:transfer` | Move stock between two warehouses                                            |
| PATCH  | `/inventory/:id/threshold` | `inventory:adjust`   | Set the low-stock threshold                                                  |

Staff can read and adjust; transfers need a manager or admin.

Errors specific to this service:

| Status | Code                                       | Meaning                                                               |
| ------ | ------------------------------------------ | --------------------------------------------------------------------- |
| 409    | `INSUFFICIENT_STOCK`                       | Not enough available units; `details` has `available` and `requested` |
| 409    | `STOCK_CONFLICT`                           | Lost a concurrency race three times; safe to retry                    |
| 400    | `PRODUCT_NOT_FOUND`, `WAREHOUSE_NOT_FOUND` | The owning service does not know this ID                              |
| 400    | `PRODUCT_ARCHIVED`, `WAREHOUSE_ARCHIVED`   | New stock cannot be recorded for archived items                       |
| 400    | `SAME_WAREHOUSE`                           | Transfer source and destination are the same                          |
| 503    | `CATALOG_UNAVAILABLE`                      | The owning service could not be reached                               |

## Data model

- **`stock_items`**: one row per (product, warehouse) with `quantity` (on
  hand), `reserved_quantity` (promised to orders; used from Phase 5),
  `low_stock_threshold` and `version`.
- **`stock_movements`**: an append-only ledger. Every change to a stock level
  inserts a row (`IN`, `OUT`, `TRANSFER_IN`, `TRANSFER_OUT`) with the quantity
  moved, the level afterwards, who did it and an optional reference and note.
  The two rows of a transfer share a `transfer_id`.
- **Available** = `quantity - reserved_quantity`. Only available units can
  leave. An item is **low on stock** when available <= threshold.
- Product and warehouse IDs are plain UUIDs with no foreign key: those tables
  live in other services' databases.

## Stock rules

The rules are pure functions in `src/stock/stock-rules.ts` (no database, no
framework), which is what the unit tests exercise:

- Quantities are whole numbers greater than zero.
- Stock out and transfers cannot take more than what is available.
- Stock can never go negative, and reserved can never exceed on-hand. The
  database repeats both as `CHECK` constraints.

## Concurrency: optimistic locking

Two requests can read the same stock item at the same moment and both decide
there is enough stock. To stop the second one from overwriting the first:

1. Each attempt reads the row, including its `version`.
2. The write is `UPDATE stock_items SET quantity = ?, version = version + 1
WHERE id = ? AND version = ?`.
3. If another request got there first, the version no longer matches, zero
   rows are updated, and the transaction is rolled back.
4. The operation starts again from a fresh read, up to 3 attempts, then
   answers `409 STOCK_CONFLICT`.

The stock level and its movement rows are written in one transaction, so the
ledger always adds up to the level. A transfer changes both warehouses in one
transaction, locking rows in a fixed order so opposite transfers cannot
deadlock. An integration test fires 12 simultaneous stock-outs at 5 units and
checks that the level and the ledger agree and nothing is oversold.

## Talking to other services

The first time stock is recorded for a product in a warehouse, the service
asks product-service and warehouse-service whether the IDs exist and are
active (`src/catalog/catalog.client.ts`): plain HTTP with the caller's token,
a timeout and retries with backoff. If the answer cannot be obtained, the
request fails with `503` instead of recording stock for something unknown.
After that first check, stock movements need no cross-service call.

## Configuration

See `.env.example`. Shared values come from the root `.env`.

| Variable                                       | Purpose                                       |
| ---------------------------------------------- | --------------------------------------------- |
| `PORT`, `DB_NAME`                              | Service port and database                     |
| `JWT_ACCESS_SECRET`                            | Verifies access tokens issued by auth-service |
| `PRODUCT_SERVICE_URL`, `WAREHOUSE_SERVICE_URL` | Where to check product and warehouse IDs      |
| `UPSTREAM_TIMEOUT_MS`, `UPSTREAM_RETRIES`      | Timeout and extra attempts for those checks   |
| `DB_MIGRATIONS_RUN`                            | Apply pending migrations at startup           |
| `SEED_DATA`                                    | Insert opening stock levels at startup        |

## Seed data

With `SEED_DATA=true` (the local default) and an empty stock table, the
service inserts 28 stock items for the seeded products and warehouses, each
with an `OPENING-BALANCE` movement. Four of them start below their threshold
so the low-stock filter has something to show.

## Commands

```bash
pnpm nx serve inventory-service      # run in watch mode
pnpm nx test inventory-service       # unit tests (no infrastructure needed)
pnpm nx test-int inventory-service   # integration tests (needs pnpm docker:up)
pnpm nx build inventory-service      # production bundle in dist/apps/inventory-service
```

Integration tests use their own database, `ims_inventory_test`, created on
demand, and replace the calls to other services with a fake.
