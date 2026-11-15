# product-service

Owns the product catalogue: categories and products. It knows what a product
_is_ (SKU, name, price, unit, attributes), not how many are in stock; that is
inventory-service's job.

- **Port:** 4002 · **Database:** `ims_product` · **API docs:** <http://localhost:4002/docs>
- **Health:** `GET /health` (checks the database)

## API

Reached from the frontend through the gateway under `/v1`.

| Method | Path              | Permission       | Description                                   |
| ------ | ----------------- | ---------------- | --------------------------------------------- |
| GET    | `/categories`     | `products:read`  | List categories (paginated, search by name)   |
| GET    | `/categories/:id` | `products:read`  | One category                                  |
| POST   | `/categories`     | `products:write` | Create a category                             |
| PATCH  | `/categories/:id` | `products:write` | Rename or re-describe                         |
| DELETE | `/categories/:id` | `products:write` | Delete; `409 CATEGORY_IN_USE` if it has items |
| GET    | `/products`       | `products:read`  | List products (see query parameters below)    |
| GET    | `/products/:id`   | `products:read`  | One product, with its category                |
| POST   | `/products`       | `products:write` | Create a product                              |
| PATCH  | `/products/:id`   | `products:write` | Update; `isActive: true` restores             |
| DELETE | `/products/:id`   | `products:write` | Archive (sets `isActive=false`)               |

Staff can read; managers and admins can also write.

### Listing products

`GET /products` accepts:

| Parameter              | Example                       | Effect                                        |
| ---------------------- | ----------------------------- | --------------------------------------------- |
| `page`, `limit`        | `page=2&limit=20`             | Pagination (limit at most 100)                |
| `search`               | `search=drill`                | Case-insensitive match on SKU or name         |
| `categoryId`           | `categoryId=<uuid>`           | Only this category                            |
| `minPrice`, `maxPrice` | `minPrice=10`                 | Price range, inclusive                        |
| `isActive`             | `isActive=true`               | Hide archived products (omit to include them) |
| `attributes`           | `attributes={"color":"blue"}` | Products having all the given attributes      |
| `sortBy`, `sortOrder`  | `sortBy=price&sortOrder=desc` | `name`, `sku`, `price` or `createdAt`         |

Every list response has the same envelope: `{ data: [...], meta: { page,
limit, total, totalPages, hasNextPage, hasPreviousPage } }`. Unknown query
parameters are rejected with `400`.

## Data model

- **SKU** is the business identifier: 2-64 characters, stored upper-cased,
  unique (`409 SKU_ALREADY_EXISTS`).
- **Price** is `numeric(12, 2)`, never a float, with at most two decimals
  accepted by the API.
- **Unit** is one of `pcs`, `box`, `pack`, `kg`, `l`, `m`.
- **Attributes** are product-specific details (`{"voltage": 18, "color":
"blue"}`) stored as JSONB: a flat object of string, number or boolean
  values. A GIN index makes the `attributes` filter an index lookup
  (`attributes @> '{"color":"blue"}'`). This avoids a column, or a table, for
  every kind of detail a product might have.
- **Category** is optional. A category that still has products cannot be
  deleted (`ON DELETE RESTRICT`).
- **Products are archived, not deleted,** because other services keep
  references to product IDs.

## Configuration

See `.env.example`. Shared values come from the root `.env`.

| Variable            | Purpose                                          |
| ------------------- | ------------------------------------------------ |
| `PORT`, `DB_NAME`   | Service port and database                        |
| `JWT_ACCESS_SECRET` | Verifies access tokens issued by auth-service    |
| `DB_MIGRATIONS_RUN` | Apply pending migrations at startup              |
| `SEED_DATA`         | Insert sample categories and products at startup |

## Seed data

With `SEED_DATA=true` (the local default) the service inserts 4 categories and
10 products (`src/seed/seed-data.ts`) on first start. Seeding is idempotent
and never overwrites existing rows.

## Commands

```bash
pnpm nx serve product-service      # run in watch mode
pnpm nx test product-service       # unit tests (no infrastructure needed)
pnpm nx test-int product-service   # integration tests (needs pnpm docker:up)
pnpm nx build product-service      # production bundle in dist/apps/product-service
```

Integration tests use their own database, `ims_product_test`, created on demand.
