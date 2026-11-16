# Architecture in five minutes

A spoken walkthrough of this project, about five minutes at a normal pace.
Each section is one beat; the bold line is the sentence to land.

## 1. What it is (30 seconds)

**It is an inventory management system built as seven NestJS microservices
and a Next.js frontend, in one Nx monorepo.**

Users manage products and warehouses, move stock in, out and between
warehouses, and place orders. Placing an order reserves stock. The
interesting part is that the order and the stock live in different services
with different databases, and they still have to agree.

## 2. The shape (45 seconds)

**The frontend talks only to an API gateway; each service owns its own
database; services talk to each other mostly through events.**

- The **gateway** checks the JWT, rate-limits with Redis, attaches a
  correlation ID and forwards the request. It holds no business logic.
- **auth, product, warehouse, inventory, order, notification** each have
  their own PostgreSQL database. No service reads another's tables.
- Shared code lives in four libraries: config, common, events and database.
  They contain no business rules, and lint rules stop apps importing each
  other.

## 3. Synchronous versus asynchronous (45 seconds)

**I use a synchronous call when the caller needs an answer to continue, and
an event when it only needs something to happen eventually.**

- Synchronous: when an order is placed, order-service asks product-service
  for current prices. It cannot build the order without them. That call has
  a timeout and retries, and fails cleanly with a 503 if the catalogue is
  down.
- Asynchronous: reserving stock. The order is saved as `PENDING` and the API
  answers immediately. Stock is reserved moments later, through RabbitMQ.

## 4. The saga (60 seconds)

**There is no distributed transaction, so an order is a saga: a chain of
local transactions joined by events, with a compensating action to undo.**

order-service is the orchestrator.

1. It saves the order as `PENDING` and publishes `OrderCreated`.
2. inventory-service reserves every line or none, and replies
   `StockReserved` or `StockReservationFailed`.
3. order-service moves the order to `CONFIRMED` or `CANCELLED`.
4. If a user cancels later, `OrderCancelled` makes inventory-service release
   the reservation. That is the compensation.

The order's state machine is a small pure function, so every transition,
including the ones that must be ignored, is unit tested.

## 5. Why it does not lose or duplicate work (75 seconds)

**Three patterns make it reliable: the outbox, idempotent consumers and
optimistic locking.**

- **Outbox.** A service never publishes to RabbitMQ inside a request.
  It writes the event to an `outbox_events` table in the same database
  transaction as the business change. A relay publishes those rows
  afterwards and retries until the broker confirms. So the order and its
  event are saved together or not at all. I tested this by stopping
  RabbitMQ: orders were still accepted, and completed when it came back.
- **Idempotent consumers.** RabbitMQ delivers at least once, so duplicates
  will happen. Each handler first inserts the event ID into a
  `processed_events` table, in the same transaction as its work. A duplicate
  hits the primary key and is skipped.
- **Optimistic locking.** Every stock write is
  `UPDATE ... WHERE id = ? AND version = ?`. If two requests race, one
  updates zero rows and retries from a fresh read. A test fires twelve
  simultaneous stock-outs at five units and checks nothing is oversold.

Messages that fail twice go to a dead-letter queue instead of blocking the
queue.

## 6. Production concerns (45 seconds)

**Every service is built the same way, so operational behaviour is
consistent.**

- Configuration is validated with Zod at startup; a bad value stops the
  process with a clear message.
- JWT access tokens last 15 minutes; refresh tokens rotate, are stored only
  as hashes, and reuse revokes the session. Passwords use Argon2.
- Logs are JSON with a correlation ID that follows a request through HTTP
  calls and events.
- Each service has health checks, Swagger docs, graceful shutdown and
  hand-written migrations.
- CI runs lint, type-check, tests and builds only for what a change affects.
  Each app has a multi-stage, non-root Docker image tagged with the commit
  SHA, ready for ECS, RDS, Amazon MQ and ElastiCache.

## 7. What I would do next (30 seconds)

**I kept the scope honest, and I know where the edges are.**

- A timeout that cancels orders stuck in `PENDING`.
- Monitoring and replay for the dead-letter queue.
- Metrics and distributed tracing with OpenTelemetry.
- Moving the refresh token to an `HttpOnly` cookie.
- A shipping step that turns a reservation into a stock-out.

## Likely follow-up questions

| Question                                             | Short answer                                                                                                                        |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Orchestration or choreography?                       | Orchestration: order-service decides. Easier to follow and to test with two participants; choreography spreads the logic around.    |
| Why not two-phase commit?                            | It needs every participant up and locks held across services. A saga trades atomicity for availability, with compensation.          |
| What if the relay crashes after publishing?          | The row is still unpublished, so it is published again. Consumers are idempotent, so the duplicate is harmless.                     |
| What if a cancellation overtakes the creation event? | inventory-service stores a "released" marker for that order, and the late `OrderCreated` reserves nothing.                          |
| Why optimistic, not pessimistic, locking?            | Conflicts on one stock row are rare and short. Optimistic locking holds no locks while waiting and cannot deadlock on a single row. |
| Why does every service verify the JWT?               | It is a local signature check, so it costs nothing, and a service stays safe even if reached without the gateway.                   |
| Why one database server locally?                     | Isolation is at the database level, which is what matters; in production each service can point at its own instance.                |
| How would you scale it?                              | Services are stateless, so add instances. Consumers share a queue. The outbox relay uses `SKIP LOCKED` so instances do not clash.   |
