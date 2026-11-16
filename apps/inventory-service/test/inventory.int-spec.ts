import { configureHttpApp, permissionsForRole, Role } from '@ims/common';
import { ensureTestDatabase } from '@ims/database';
import { BadRequestException, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { CatalogClient } from '../src/catalog/catalog.client';

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const DRILL = uuid(101);
const SAW = uuid(102);
const UNKNOWN_PRODUCT = uuid(199);
const NYC = uuid(201);
const LONDON = uuid(202);

/** Stands in for product-service and warehouse-service. */
const catalog = {
  assertProductUsable: jest.fn(async (id: string) => {
    if (id === UNKNOWN_PRODUCT) {
      throw new BadRequestException({
        error: 'PRODUCT_NOT_FOUND',
        message: 'no such product',
      });
    }
  }),
  assertWarehouseUsable: jest.fn(async () => undefined),
};

/**
 * Boots the real AppModule against a real PostgreSQL database (migrations
 * included) and drives it over HTTP. Only the calls to other services are
 * faked.
 */
describe('inventory-service (integration)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let dataSource: DataSource;
  let manager: string;
  let staff: string;

  const tokenFor = (role: Role) =>
    `Bearer ${app.get(JwtService).sign({
      sub: uuid(1),
      email: `${role.toLowerCase()}@ims.local`,
      role,
      permissions: permissionsForRole(role),
    })}`;

  const post = (path: string, body: object, token = manager) =>
    http.post(`/inventory/${path}`).set('Authorization', token).send(body);

  const stockOf = async (productId: string, warehouseId: string) => {
    const response = await http
      .get(`/inventory?productId=${productId}&warehouseId=${warehouseId}`)
      .set('Authorization', staff)
      .expect(200);
    return response.body.data[0] as
      { id: string; quantity: number; lowStock: boolean } | undefined;
  };

  beforeAll(async () => {
    await ensureTestDatabase();
    // Imported lazily so the env from setup-env.ts is in place first.
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CatalogClient)
      .useValue(catalog)
      .compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    configureHttpApp(app, { serviceName: 'inventory-service' });
    await app.init();

    dataSource = app.get(DataSource);
    await dataSource.query(
      'TRUNCATE TABLE stock_movements, stock_items, stock_reservations, outbox_events, processed_events',
    );
    http = request(app.getHttpServer());
    manager = tokenFor(Role.Manager);
    staff = tokenFor(Role.Staff);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('reports healthy when the database is reachable', async () => {
    const response = await http.get('/health').expect(200);

    expect(response.body.details.database.status).toBe('up');
  });

  it('requires a token', async () => {
    await http.get('/inventory').expect(401);
  });

  it('receives stock, checking the product and warehouse the first time only', async () => {
    const first = await post('stock-in', {
      productId: DRILL,
      warehouseId: NYC,
      quantity: 20,
      reference: 'PO-1',
    }).expect(201);

    expect(first.body.stock).toMatchObject({
      productId: DRILL,
      warehouseId: NYC,
      quantity: 20,
      reservedQuantity: 0,
      availableQuantity: 20,
    });
    expect(first.body.movement).toMatchObject({
      type: 'IN',
      quantity: 20,
      quantityAfter: 20,
      reference: 'PO-1',
      performedBy: uuid(1),
    });
    expect(catalog.assertProductUsable).toHaveBeenCalledTimes(1);
    expect(catalog.assertProductUsable).toHaveBeenCalledWith(DRILL, manager);

    const second = await post('stock-in', {
      productId: DRILL,
      warehouseId: NYC,
      quantity: 5,
    }).expect(201);
    expect(second.body.stock.quantity).toBe(25);
    expect(catalog.assertProductUsable).toHaveBeenCalledTimes(1);
  });

  it('refuses stock for a product the catalogue does not know', async () => {
    const response = await post('stock-in', {
      productId: UNKNOWN_PRODUCT,
      warehouseId: NYC,
      quantity: 1,
    }).expect(400);

    expect(response.body.error).toBe('PRODUCT_NOT_FOUND');
    expect(await stockOf(UNKNOWN_PRODUCT, NYC)).toBeUndefined();
  });

  it('rejects invalid quantities', async () => {
    for (const quantity of [0, -5, 1.5]) {
      const response = await post('stock-in', {
        productId: DRILL,
        warehouseId: NYC,
        quantity,
      }).expect(400);
      expect(response.body.error).toBe('VALIDATION_FAILED');
    }
  });

  it('removes stock, and refuses to go below zero', async () => {
    const out = await post('stock-out', {
      productId: DRILL,
      warehouseId: NYC,
      quantity: 5,
    }).expect(201);
    expect(out.body.stock.quantity).toBe(20);
    expect(out.body.movement).toMatchObject({ type: 'OUT', quantityAfter: 20 });

    const tooMany = await post('stock-out', {
      productId: DRILL,
      warehouseId: NYC,
      quantity: 21,
    }).expect(409);
    expect(tooMany.body).toMatchObject({
      error: 'INSUFFICIENT_STOCK',
      details: { available: 20, requested: 21 },
    });

    const neverStocked = await post('stock-out', {
      productId: SAW,
      warehouseId: NYC,
      quantity: 1,
    }).expect(409);
    expect(neverStocked.body.error).toBe('INSUFFICIENT_STOCK');
  });

  it('does not let reserved units leave', async () => {
    const item = await stockOf(DRILL, NYC);
    await dataSource.query(
      'UPDATE stock_items SET reserved_quantity = 15 WHERE id = $1',
      [item?.id],
    );

    const response = await post('stock-out', {
      productId: DRILL,
      warehouseId: NYC,
      quantity: 6,
    }).expect(409);
    expect(response.body.details).toEqual({ available: 5, requested: 6 });

    await dataSource.query(
      'UPDATE stock_items SET reserved_quantity = 0 WHERE id = $1',
      [item?.id],
    );
  });

  it('transfers between warehouses atomically, with paired movements', async () => {
    const response = await post('transfer', {
      productId: DRILL,
      fromWarehouseId: NYC,
      toWarehouseId: LONDON,
      quantity: 8,
      note: 'Rebalance',
    }).expect(201);

    expect(response.body.source).toMatchObject({
      warehouseId: NYC,
      quantity: 12,
    });
    expect(response.body.destination).toMatchObject({
      warehouseId: LONDON,
      quantity: 8,
    });

    const movements = await dataSource.query(
      'SELECT type, quantity, quantity_after FROM stock_movements WHERE transfer_id = $1 ORDER BY type',
      [response.body.transferId],
    );
    expect(movements).toEqual([
      { type: 'TRANSFER_IN', quantity: 8, quantity_after: 8 },
      { type: 'TRANSFER_OUT', quantity: 8, quantity_after: 12 },
    ]);
  });

  it('leaves both warehouses untouched when a transfer cannot be completed', async () => {
    const response = await post('transfer', {
      productId: DRILL,
      fromWarehouseId: NYC,
      toWarehouseId: LONDON,
      quantity: 500,
    }).expect(409);

    expect(response.body.error).toBe('INSUFFICIENT_STOCK');
    expect((await stockOf(DRILL, NYC))?.quantity).toBe(12);
    expect((await stockOf(DRILL, LONDON))?.quantity).toBe(8);
  });

  it('rejects a transfer to the same warehouse', async () => {
    const response = await post('transfer', {
      productId: DRILL,
      fromWarehouseId: NYC,
      toWarehouseId: NYC,
      quantity: 1,
    }).expect(400);

    expect(response.body.error).toBe('SAME_WAREHOUSE');
  });

  it('lets staff adjust stock but not transfer it', async () => {
    await post(
      'stock-in',
      { productId: DRILL, warehouseId: NYC, quantity: 1 },
      staff,
    ).expect(201);

    const response = await post(
      'transfer',
      {
        productId: DRILL,
        fromWarehouseId: NYC,
        toWarehouseId: LONDON,
        quantity: 1,
      },
      staff,
    ).expect(403);
    expect(response.body.error).toBe('FORBIDDEN');
  });

  it('flags low stock against the threshold and filters by it', async () => {
    const london = await stockOf(DRILL, LONDON);
    expect(london?.lowStock).toBe(false);

    const updated = await http
      .patch(`/inventory/${london?.id}/threshold`)
      .set('Authorization', manager)
      .send({ lowStockThreshold: 10 })
      .expect(200);
    expect(updated.body).toMatchObject({
      quantity: 8,
      lowStockThreshold: 10,
      lowStock: true,
    });

    const low = await http
      .get('/inventory?lowStock=true')
      .set('Authorization', staff)
      .expect(200);
    expect(
      low.body.data.map((row: { warehouseId: string }) => row.warehouseId),
    ).toEqual([LONDON]);
  });

  it('records a LowStockDetected event when a stock-out crosses the threshold', async () => {
    await post('stock-in', {
      productId: SAW,
      warehouseId: LONDON,
      quantity: 10,
    }).expect(201);
    const item = await stockOf(SAW, LONDON);
    await http
      .patch(`/inventory/${item?.id}/threshold`)
      .set('Authorization', manager)
      .send({ lowStockThreshold: 4 })
      .expect(200);

    const lowStockEvents = () =>
      dataSource.query(
        `SELECT payload FROM outbox_events WHERE event_name = 'stock.low_detected' AND payload->'payload'->>'productId' = $1`,
        [SAW],
      );

    // 10 -> 6: still above the threshold, so no event.
    await post('stock-out', {
      productId: SAW,
      warehouseId: LONDON,
      quantity: 4,
    }).expect(201);
    expect(await lowStockEvents()).toHaveLength(0);

    // 6 -> 3: crosses it. The event is written with the stock change.
    await post('stock-out', {
      productId: SAW,
      warehouseId: LONDON,
      quantity: 3,
    }).expect(201);
    const [row] = await lowStockEvents();
    expect(row.payload.payload).toEqual({
      productId: SAW,
      warehouseId: LONDON,
      availableQuantity: 3,
      threshold: 4,
    });

    // 3 -> 2: already low, so it is not announced again.
    await post('stock-out', {
      productId: SAW,
      warehouseId: LONDON,
      quantity: 1,
    }).expect(201);
    expect(await lowStockEvents()).toHaveLength(1);
  });

  it('keeps a complete movement history, newest first', async () => {
    const response = await http
      .get(`/inventory/movements?productId=${DRILL}&warehouseId=${NYC}`)
      .set('Authorization', staff)
      .expect(200);

    const types = response.body.data.map((row: { type: string }) => row.type);
    expect(types).toEqual(['IN', 'TRANSFER_OUT', 'OUT', 'IN', 'IN']);

    const onlyTransfers = await http
      .get('/inventory/movements?type=TRANSFER_IN')
      .set('Authorization', staff)
      .expect(200);
    expect(onlyTransfers.body.meta.total).toBe(1);
  });

  it('never oversells when many requests hit the same stock at once', async () => {
    await post('stock-in', {
      productId: SAW,
      warehouseId: NYC,
      quantity: 5,
    }).expect(201);

    // 12 people each try to take 1 of the 5 units at the same moment.
    const responses = await Promise.all(
      Array.from({ length: 12 }, () =>
        post('stock-out', { productId: SAW, warehouseId: NYC, quantity: 1 }),
      ),
    );

    const succeeded = responses.filter((res) => res.status === 201).length;
    const rejected = responses.filter((res) => res.status === 409);
    expect(succeeded + rejected.length).toBe(12);
    expect(succeeded).toBeGreaterThan(0);
    expect(succeeded).toBeLessThanOrEqual(5);
    for (const res of rejected) {
      expect(['INSUFFICIENT_STOCK', 'STOCK_CONFLICT']).toContain(
        res.body.error,
      );
    }

    // The level and the ledger agree with the number of successful requests.
    const item = await stockOf(SAW, NYC);
    expect(item?.quantity).toBe(5 - succeeded);
    const [{ count }] = await dataSource.query(
      `SELECT count(*)::int AS count FROM stock_movements WHERE stock_item_id = $1 AND type = 'OUT'`,
      [item?.id],
    );
    expect(count).toBe(succeeded);
  });
});
