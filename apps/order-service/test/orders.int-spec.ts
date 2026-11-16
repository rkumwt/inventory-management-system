import {
  configureHttpApp,
  EVENT_PUBLISHER,
  permissionsForRole,
  Role,
} from '@ims/common';
import { ensureTestDatabase, OutboxRelay } from '@ims/database';
import { createEvent, EventEnvelope, EventName } from '@ims/events';
import { BadRequestException, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { CatalogClient } from '../src/catalog/catalog.client';
import { OrderSagaService } from '../src/saga/order-saga.service';

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const DRILL = {
  id: uuid(101),
  sku: 'DRL-18V-001',
  name: 'Drill',
  price: 129.99,
};
const HAMMER = {
  id: uuid(102),
  sku: 'HMR-CLW-016',
  name: 'Hammer',
  price: 18.75,
};
const UNKNOWN_PRODUCT = uuid(199);
const WAREHOUSE = uuid(201);

/** Stands in for product-service and warehouse-service. */
const catalog = {
  getProduct: jest.fn(async (id: string) => {
    const product = [DRILL, HAMMER].find((item) => item.id === id);
    if (!product) {
      throw new BadRequestException({
        error: 'PRODUCT_NOT_FOUND',
        message: 'no such product',
      });
    }
    return product;
  }),
  assertWarehouseUsable: jest.fn(async () => undefined),
};

/** Stands in for RabbitMQ: records what the outbox relay publishes. */
const broker = {
  published: [] as EventEnvelope[],
  failing: false,
  publish: jest.fn(async (event: EventEnvelope) => {
    if (broker.failing) throw new Error('broker unreachable');
    broker.published.push(event);
  }),
};

/**
 * Boots the real AppModule against a real PostgreSQL database and drives the
 * saga from order-service's point of view: HTTP requests in, events in
 * (handed straight to the handlers), events out (through the outbox relay).
 */
describe('order-service (integration)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let dataSource: DataSource;
  let saga: OrderSagaService;
  let relay: OutboxRelay;
  let manager: string;
  let staff: string;

  const tokenFor = (role: Role) =>
    `Bearer ${app.get(JwtService).sign({
      sub: uuid(1),
      email: `${role.toLowerCase()}@ims.local`,
      role,
      permissions: permissionsForRole(role),
    })}`;

  const placeOrder = async (
    items = [
      { productId: DRILL.id, quantity: 2 },
      { productId: HAMMER.id, quantity: 3 },
    ],
  ) => {
    const response = await http
      .post('/orders')
      .set('Authorization', staff)
      .send({ warehouseId: WAREHOUSE, items })
      .expect(201);
    return response.body as { id: string; orderNumber: string; status: string };
  };

  const getOrder = async (id: string) =>
    (await http.get(`/orders/${id}`).set('Authorization', staff).expect(200))
      .body as { status: string; cancellationReason: string | null };

  const stockReserved = (orderId: string) =>
    createEvent(
      EventName.StockReserved,
      { orderId, warehouseId: WAREHOUSE, items: [] },
      'corr-saga',
    );

  const reservationFailed = (orderId: string) =>
    createEvent(
      EventName.StockReservationFailed,
      {
        orderId,
        warehouseId: WAREHOUSE,
        reason: 'INSUFFICIENT_STOCK',
        shortages: [{ productId: DRILL.id, requested: 2, available: 1 }],
      },
      'corr-saga',
    );

  /** Names of the events recorded for one order, oldest first. */
  const outboxFor = async (orderId: string) => {
    const rows = await dataSource.query(
      `SELECT event_name FROM outbox_events WHERE payload->'payload'->>'orderId' = $1 ORDER BY created_at`,
      [orderId],
    );
    return (rows as Array<{ event_name: string }>).map((row) => row.event_name);
  };

  beforeAll(async () => {
    await ensureTestDatabase();
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CatalogClient)
      .useValue(catalog)
      .overrideProvider(EVENT_PUBLISHER)
      .useValue(broker)
      .compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    configureHttpApp(app, { serviceName: 'order-service' });
    await app.init();

    dataSource = app.get(DataSource);
    saga = app.get(OrderSagaService);
    relay = app.get(OutboxRelay);
    http = request(app.getHttpServer());
    manager = tokenFor(Role.Manager);
    staff = tokenFor(Role.Staff);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE order_items, orders, outbox_events, processed_events CASCADE',
    );
    broker.published = [];
    broker.failing = false;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('reports healthy and requires a token', async () => {
    await http.get('/health').expect(200);
    await http.get('/orders').expect(401);
  });

  describe('placing an order', () => {
    it('saves it as PENDING with prices copied from the catalogue', async () => {
      const response = await http
        .post('/orders')
        .set('Authorization', staff)
        .send({
          warehouseId: WAREHOUSE,
          items: [
            { productId: DRILL.id, quantity: 2 },
            { productId: HAMMER.id, quantity: 3 },
          ],
          note: 'Deliver before Friday',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        status: 'PENDING',
        warehouseId: WAREHOUSE,
        totalAmount: 316.23,
        note: 'Deliver before Friday',
        createdBy: uuid(1),
      });
      expect(response.body.orderNumber).toMatch(/^ORD-\d{8}-[A-Z2-9]{6}$/);
      expect(response.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sku: 'DRL-18V-001',
            quantity: 2,
            unitPrice: 129.99,
            lineTotal: 259.98,
          }),
          expect.objectContaining({
            sku: 'HMR-CLW-016',
            quantity: 3,
            lineTotal: 56.25,
          }),
        ]),
      );
    });

    it('records OrderCreated in the outbox, in the same transaction', async () => {
      const order = await placeOrder();

      const [row] = await dataSource.query(
        'SELECT id, event_name, payload, published_at FROM outbox_events',
      );
      expect(row.event_name).toBe(EventName.OrderCreated);
      expect(row.published_at).toBeNull();
      expect(row.payload.eventId).toBe(row.id);
      expect(row.payload.payload).toMatchObject({
        orderId: order.id,
        orderNumber: order.orderNumber,
        warehouseId: WAREHOUSE,
        totalAmount: 316.23,
        createdByEmail: 'staff@ims.local',
        items: [
          {
            productId: DRILL.id,
            sku: DRILL.sku,
            quantity: 2,
            unitPrice: 129.99,
          },
          {
            productId: HAMMER.id,
            sku: HAMMER.sku,
            quantity: 3,
            unitPrice: 18.75,
          },
        ],
      });
    });

    it('saves nothing and announces nothing when a product is unknown', async () => {
      const response = await http
        .post('/orders')
        .set('Authorization', staff)
        .send({
          warehouseId: WAREHOUSE,
          items: [
            { productId: DRILL.id, quantity: 1 },
            { productId: UNKNOWN_PRODUCT, quantity: 1 },
          ],
        })
        .expect(400);

      expect(response.body.error).toBe('PRODUCT_NOT_FOUND');
      const [{ orders, events }] = await dataSource.query(
        'SELECT (SELECT count(*)::int FROM orders) AS orders, (SELECT count(*)::int FROM outbox_events) AS events',
      );
      expect({ orders, events }).toEqual({ orders: 0, events: 0 });
    });

    it.each([
      ['no items', { warehouseId: WAREHOUSE, items: [] }],
      [
        'a zero quantity',
        {
          warehouseId: WAREHOUSE,
          items: [{ productId: DRILL.id, quantity: 0 }],
        },
      ],
      [
        'the same product twice',
        {
          warehouseId: WAREHOUSE,
          items: [
            { productId: DRILL.id, quantity: 1 },
            { productId: DRILL.id, quantity: 2 },
          ],
        },
      ],
      [
        'a client-supplied price',
        {
          warehouseId: WAREHOUSE,
          items: [{ productId: DRILL.id, quantity: 1, unitPrice: 0.01 }],
        },
      ],
    ])('rejects %s', async (_label, body) => {
      const response = await http
        .post('/orders')
        .set('Authorization', staff)
        .send(body)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_FAILED');
    });
  });

  describe('saga: replies from inventory-service', () => {
    it('StockReserved confirms the order and records OrderConfirmed', async () => {
      const order = await placeOrder();

      await saga.handleStockReserved(stockReserved(order.id));

      expect((await getOrder(order.id)).status).toBe('CONFIRMED');
      expect(await outboxFor(order.id)).toEqual([
        EventName.OrderCreated,
        EventName.OrderConfirmed,
      ]);
    });

    it('is idempotent: a redelivered StockReserved changes nothing more', async () => {
      const order = await placeOrder();
      const event = stockReserved(order.id);

      await saga.handleStockReserved(event);
      await saga.handleStockReserved(event);

      expect(await outboxFor(order.id)).toEqual([
        EventName.OrderCreated,
        EventName.OrderConfirmed,
      ]);
      const [{ count }] = await dataSource.query(
        'SELECT count(*)::int AS count FROM processed_events',
      );
      expect(count).toBe(1);
    });

    it('StockReservationFailed cancels the order with a readable reason', async () => {
      const order = await placeOrder();

      await saga.handleStockReservationFailed(reservationFailed(order.id));

      expect(await getOrder(order.id)).toMatchObject({
        status: 'CANCELLED',
        cancellationReason:
          'Insufficient stock (DRL-18V-001: requested 2, available 1)',
      });
      expect(await outboxFor(order.id)).toEqual([
        EventName.OrderCreated,
        EventName.OrderCancelled,
      ]);
    });

    it('keeps the correlation ID of the request that started the saga', async () => {
      const order = await placeOrder();

      await saga.handleStockReserved(stockReserved(order.id));

      const [row] = await dataSource.query(
        `SELECT payload->>'correlationId' AS correlation FROM outbox_events WHERE event_name = $1`,
        [EventName.OrderConfirmed],
      );
      expect(row.correlation).toBe('corr-saga');
    });
  });

  describe('cancelling', () => {
    const cancel = (id: string, token = manager, body: object = {}) =>
      http.post(`/orders/${id}/cancel`).set('Authorization', token).send(body);

    it('cancels a confirmed order and records OrderCancelled (compensation)', async () => {
      const order = await placeOrder();
      await saga.handleStockReserved(stockReserved(order.id));

      const response = await cancel(order.id, manager, {
        reason: 'Customer changed their mind',
      }).expect(200);

      expect(response.body).toMatchObject({
        status: 'CANCELLED',
        cancellationReason: 'Customer changed their mind',
      });
      expect(await outboxFor(order.id)).toEqual([
        EventName.OrderCreated,
        EventName.OrderConfirmed,
        EventName.OrderCancelled,
      ]);
    });

    it('ignores a StockReserved that arrives after the user cancelled', async () => {
      const order = await placeOrder();
      await cancel(order.id).expect(200);

      await saga.handleStockReserved(stockReserved(order.id));

      expect((await getOrder(order.id)).status).toBe('CANCELLED');
      expect(await outboxFor(order.id)).toEqual([
        EventName.OrderCreated,
        EventName.OrderCancelled,
      ]);
    });

    it('refuses to cancel twice', async () => {
      const order = await placeOrder();
      await cancel(order.id).expect(200);

      const response = await cancel(order.id).expect(409);

      expect(response.body.error).toBe('ORDER_NOT_CANCELLABLE');
      expect(await outboxFor(order.id)).toHaveLength(2);
    });

    it('needs the cancel permission, which staff do not have', async () => {
      const order = await placeOrder();

      const response = await cancel(order.id, staff).expect(403);

      expect(response.body.error).toBe('FORBIDDEN');
    });

    it('answers 404 for an unknown order', async () => {
      await cancel(uuid(999)).expect(404);
    });
  });

  describe('outbox relay', () => {
    it('publishes pending events in order and marks them published', async () => {
      const order = await placeOrder();
      await saga.handleStockReserved(stockReserved(order.id));

      expect(await relay.publishPending()).toBe(2);

      expect(broker.published.map((event) => event.eventName)).toEqual([
        EventName.OrderCreated,
        EventName.OrderConfirmed,
      ]);
      // Nothing left: a second run publishes nothing.
      expect(await relay.publishPending()).toBe(0);
      expect(broker.published).toHaveLength(2);
    });

    it('keeps events when the broker is down, and delivers them once it is back', async () => {
      await placeOrder();
      broker.failing = true;

      expect(await relay.publishPending()).toBe(0);

      const [row] = await dataSource.query(
        'SELECT published_at, attempts, last_error FROM outbox_events',
      );
      expect(row).toEqual({
        published_at: null,
        attempts: 1,
        last_error: 'broker unreachable',
      });

      broker.failing = false;
      expect(await relay.publishPending()).toBe(1);
      expect(broker.published).toHaveLength(1);
    });

    it('does not publish later events ahead of one that failed', async () => {
      const order = await placeOrder();
      await saga.handleStockReserved(stockReserved(order.id));
      broker.publish.mockRejectedValueOnce(new Error('broker unreachable'));

      expect(await relay.publishPending()).toBe(0);
      expect(broker.published).toHaveLength(0);
    });
  });

  it('lists orders newest first, filterable by status and order number', async () => {
    const first = await placeOrder();
    const second = await placeOrder([{ productId: HAMMER.id, quantity: 1 }]);
    await saga.handleStockReserved(stockReserved(first.id));

    const all = await http
      .get('/orders')
      .set('Authorization', staff)
      .expect(200);
    expect(all.body.meta.total).toBe(2);
    expect(all.body.data[0].id).toBe(second.id);

    const confirmed = await http
      .get('/orders?status=CONFIRMED')
      .set('Authorization', staff)
      .expect(200);
    expect(confirmed.body.data.map((row: { id: string }) => row.id)).toEqual([
      first.id,
    ]);

    const byNumber = await http
      .get(`/orders?search=${second.orderNumber.slice(-6)}`)
      .set('Authorization', staff)
      .expect(200);
    expect(byNumber.body.data).toHaveLength(1);
  });
});
