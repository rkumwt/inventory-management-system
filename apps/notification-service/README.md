# notification-service

Listens for events and turns them into emails. Emails are **mocked**: each
one is written to the log and stored in the database, never actually sent.

- **Port:** 4006 · **Database:** `ims_notification` · **API docs:** <http://localhost:4006/docs>
- **Health:** `GET /health` (checks the database)

## Events

Queue `ims.notification.events`. This service only consumes; it publishes
nothing and no other service calls it.

| Consumes           | Email to                      | Subject                    |
| ------------------ | ----------------------------- | -------------------------- |
| `OrderConfirmed`   | The user who placed the order | `Order <number> confirmed` |
| `OrderCancelled`   | The user who placed the order | `Order <number> cancelled` |
| `LowStockDetected` | `LOW_STOCK_ALERT_EMAIL`       | `Low stock: product <id>`  |

- **Wording and recipients** are decided by a pure function,
  `src/notifications/notification-templates.ts`, which is what the unit
  tests cover.
- **Idempotent.** The event ID and the notification record are written in
  one transaction, so a redelivered event does not send a second email.
- **A failed send is retried.** Sending happens inside that transaction; if
  it throws, nothing is recorded and RabbitMQ redelivers the event.
- **Swappable sender.** `EmailSender` is a one-method interface. Replacing
  `MockEmailSender` with a real provider (e.g. Amazon SES) is a one-line
  change in `notifications.module.ts`.

Because other services only publish events, notification-service can be
down without affecting orders: its messages wait in the queue.

## API

| Method | Path             | Permission           | Description                                           |
| ------ | ---------------- | -------------------- | ----------------------------------------------------- |
| GET    | `/notifications` | `notifications:read` | Emails that were sent, newest first; filter by `type` |

Managers and admins only.

## Configuration

See `.env.example`. Shared values come from the root `.env`.

| Variable                | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| `PORT`, `DB_NAME`       | Service port and database                     |
| `JWT_ACCESS_SECRET`     | Verifies access tokens issued by auth-service |
| `RABBITMQ_URL`          | Broker for events                             |
| `LOW_STOCK_ALERT_EMAIL` | Recipient of low-stock alerts                 |
| `DB_MIGRATIONS_RUN`     | Apply pending migrations at startup           |

## Commands

```bash
pnpm nx serve notification-service      # run in watch mode
pnpm nx test notification-service       # unit tests (no infrastructure needed)
pnpm nx test-int notification-service   # integration tests (needs pnpm docker:up)
pnpm nx build notification-service      # production bundle in dist/apps/notification-service
```

Integration tests use their own database, `ims_notification_test`, and a fake
email sender. They need no RabbitMQ.
