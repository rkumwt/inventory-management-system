import { ensureTestDatabase } from '@ims/database';
import { createEvent, EventName } from '@ims/events';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ReservationsService } from '../src/reservations/reservations.service';

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const DRILL = uuid(301);
const SAW = uuid(302);
const WAREHOUSE = uuid(401);

/**
 * inventory-service's side of the order saga, against a real database.
 * Events are handed to the handler directly (no broker), and the replies are
 * read from the outbox table.
 */
describe('inventory-service reservations (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let reservations: ReservationsService;
  let nextOrder = 500;

  const orderCreated = (
    orderId: string,
    items: Array<{ productId: string; quantity: number }>,
  ) =>
    createEvent(
      EventName.OrderCreated,
      {
        orderId,
        orderNumber: `ORD-TEST-${orderId.slice(-4)}`,
        warehouseId: WAREHOUSE,
        items: items.map((item) => ({ ...item, sku: 'SKU', unitPrice: 10 })),
        totalAmount: 0,
        createdBy: uuid(1),
        createdByEmail: 'staff@ims.local',
      },
      'corr-test',
    );

  const orderCancelled = (orderId: string) =>
    createEvent(
      EventName.OrderCancelled,
      {
        orderId,
        orderNumber: `ORD-TEST-${orderId.slice(-4)}`,
        warehouseId: WAREHOUSE,
        reason: 'Cancelled by user',
        createdBy: uuid(1),
        createdByEmail: 'staff@ims.local',
      },
      'corr-test',
    );

  const levels = async (productId: string) => {
    const [row] = await dataSource.query(
      'SELECT quantity, reserved_quantity AS reserved FROM stock_items WHERE product_id = $1',
      [productId],
    );
    return row as { quantity: number; reserved: number };
  };

  /** Events written to the outbox for one order, oldest first. */
  const outboxFor = async (orderId: string) => {
    const rows = await dataSource.query(
      `SELECT event_name, payload FROM outbox_events WHERE payload->'payload'->>'orderId' = $1 ORDER BY created_at`,
      [orderId],
    );
    return rows as Array<{
      event_name: string;
      payload: { correlationId: string; payload: Record<string, unknown> };
    }>;
  };

  beforeAll(async () => {
    await ensureTestDatabase();
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    await app.init();

    dataSource = app.get(DataSource);
    reservations = app.get(ReservationsService);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE stock_movements, stock_items, stock_reservations, outbox_events, processed_events',
    );
    await dataSource.query(
      `INSERT INTO stock_items (product_id, warehouse_id, quantity, low_stock_threshold)
       VALUES ($1, $3, 10, 2), ($2, $3, 4, 0)`,
      [DRILL, SAW, WAREHOUSE],
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it('reserves every line and answers StockReserved, in one transaction', async () => {
    const orderId = uuid(nextOrder++);

    await reservations.handleOrderCreated(
      orderCreated(orderId, [
        { productId: DRILL, quantity: 3 },
        { productId: SAW, quantity: 4 },
      ]),
    );

    expect(await levels(DRILL)).toEqual({ quantity: 10, reserved: 3 });
    expect(await levels(SAW)).toEqual({ quantity: 4, reserved: 4 });

    const [reply] = await outboxFor(orderId);
    expect(reply?.event_name).toBe(EventName.StockReserved);
    expect(reply?.payload.correlationId).toBe('corr-test');
    expect(reply?.payload.payload).toMatchObject({
      orderId,
      warehouseId: WAREHOUSE,
      items: [
        { productId: DRILL, quantity: 3 },
        { productId: SAW, quantity: 4 },
      ],
    });
  });

  it('is idempotent: the same event delivered twice reserves once', async () => {
    const orderId = uuid(nextOrder++);
    const event = orderCreated(orderId, [{ productId: DRILL, quantity: 3 }]);

    await reservations.handleOrderCreated(event);
    await reservations.handleOrderCreated(event);

    expect((await levels(DRILL)).reserved).toBe(3);
    expect(await outboxFor(orderId)).toHaveLength(1);
  });

  it('reserves nothing when any line is short, and says which', async () => {
    const orderId = uuid(nextOrder++);

    await reservations.handleOrderCreated(
      orderCreated(orderId, [
        { productId: DRILL, quantity: 3 }, // available
        { productId: SAW, quantity: 5 }, // only 4
      ]),
    );

    expect((await levels(DRILL)).reserved).toBe(0);
    expect((await levels(SAW)).reserved).toBe(0);

    const [reply] = await outboxFor(orderId);
    expect(reply?.event_name).toBe(EventName.StockReservationFailed);
    expect(reply?.payload.payload).toMatchObject({
      reason: 'INSUFFICIENT_STOCK',
      shortages: [{ productId: SAW, requested: 5, available: 4 }],
    });
  });

  it('treats stock already reserved for another order as unavailable', async () => {
    const first = uuid(nextOrder++);
    const second = uuid(nextOrder++);

    await reservations.handleOrderCreated(
      orderCreated(first, [{ productId: SAW, quantity: 3 }]),
    );
    await reservations.handleOrderCreated(
      orderCreated(second, [{ productId: SAW, quantity: 2 }]),
    );

    expect((await levels(SAW)).reserved).toBe(3);
    const [reply] = await outboxFor(second);
    expect(reply?.event_name).toBe(EventName.StockReservationFailed);
    expect(reply?.payload.payload).toMatchObject({
      shortages: [{ productId: SAW, requested: 2, available: 1 }],
    });
  });

  it('releases the reservation when the order is cancelled (compensation)', async () => {
    const orderId = uuid(nextOrder++);
    await reservations.handleOrderCreated(
      orderCreated(orderId, [{ productId: DRILL, quantity: 3 }]),
    );
    const cancelled = orderCancelled(orderId);

    await reservations.handleOrderCancelled(cancelled);
    await reservations.handleOrderCancelled(cancelled); // duplicate delivery

    expect(await levels(DRILL)).toEqual({ quantity: 10, reserved: 0 });
    const events = (await outboxFor(orderId)).map((row) => row.event_name);
    expect(events).toEqual([EventName.StockReserved, EventName.StockReleased]);
  });

  it('releases nothing for an order whose reservation was rejected', async () => {
    const orderId = uuid(nextOrder++);
    await reservations.handleOrderCreated(
      orderCreated(orderId, [{ productId: SAW, quantity: 99 }]),
    );

    await reservations.handleOrderCancelled(orderCancelled(orderId));

    const events = (await outboxFor(orderId)).map((row) => row.event_name);
    expect(events).toEqual([EventName.StockReservationFailed]);
  });

  it('does not reserve for an order whose cancellation arrived first', async () => {
    const orderId = uuid(nextOrder++);

    await reservations.handleOrderCancelled(orderCancelled(orderId));
    await reservations.handleOrderCreated(
      orderCreated(orderId, [{ productId: DRILL, quantity: 3 }]),
    );

    expect((await levels(DRILL)).reserved).toBe(0);
    expect(await outboxFor(orderId)).toHaveLength(0);
  });

  it('announces low stock when a reservation eats into the threshold', async () => {
    const orderId = uuid(nextOrder++);

    // 10 on hand, threshold 2: reserving 8 leaves exactly 2 available.
    await reservations.handleOrderCreated(
      orderCreated(orderId, [{ productId: DRILL, quantity: 8 }]),
    );

    const [row] = await dataSource.query(
      `SELECT payload FROM outbox_events WHERE event_name = $1`,
      [EventName.LowStockDetected],
    );
    expect(row.payload.payload).toEqual({
      productId: DRILL,
      warehouseId: WAREHOUSE,
      availableQuantity: 2,
      threshold: 2,
    });
  });

  it('never over-reserves when orders for the same stock arrive together', async () => {
    // 4 saws; six orders want 1 each, all at the same moment.
    const orders = Array.from({ length: 6 }, () => uuid(nextOrder++));

    await Promise.allSettled(
      orders.map((orderId) =>
        reservations.handleOrderCreated(
          orderCreated(orderId, [{ productId: SAW, quantity: 1 }]),
        ),
      ),
    );

    const { reserved } = await levels(SAW);
    const [{ count }] = await dataSource.query(
      `SELECT count(*)::int AS count FROM stock_reservations WHERE status = 'RESERVED'`,
    );
    expect(reserved).toBeLessThanOrEqual(4);
    expect(reserved).toBe(count);
  });
});
