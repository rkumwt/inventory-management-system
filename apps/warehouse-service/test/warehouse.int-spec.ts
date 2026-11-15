import { configureHttpApp, permissionsForRole, Role } from '@ims/common';
import { ensureTestDatabase } from '@ims/database';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';

/**
 * Boots the real AppModule against a real PostgreSQL database (migrations
 * included) and drives it over HTTP with signed access tokens.
 */
describe('warehouse-service (integration)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let manager: string;
  let staff: string;
  let nycId: string;
  let londonId: string;
  let locationId: string;

  const tokenFor = (role: Role) =>
    `Bearer ${app.get(JwtService).sign({
      sub: '00000000-0000-4000-8000-000000000001',
      email: `${role.toLowerCase()}@ims.local`,
      role,
      permissions: permissionsForRole(role),
    })}`;

  const createWarehouse = (body: object) =>
    http.post('/warehouses').set('Authorization', manager).send(body);

  beforeAll(async () => {
    await ensureTestDatabase();
    // Imported lazily so the env from setup-env.ts is in place first.
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    configureHttpApp(app, { serviceName: 'warehouse-service' });
    await app.init();

    await app
      .get(DataSource)
      .query('TRUNCATE TABLE storage_locations, warehouses');
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

  it('requires a token, and write permission to create', async () => {
    await http.get('/warehouses').expect(401);

    const response = await http
      .post('/warehouses')
      .set('Authorization', staff)
      .send({ code: 'WH-X', name: 'X', city: 'X', country: 'X' })
      .expect(403);
    expect(response.body.error).toBe('FORBIDDEN');
  });

  it('creates warehouses, upper-casing the code', async () => {
    const nyc = await createWarehouse({
      code: 'wh-nyc',
      name: 'New York Distribution Center',
      address: '500 Harbor Blvd',
      city: 'New York',
      country: 'United States',
    }).expect(201);
    nycId = nyc.body.id;
    expect(nyc.body).toMatchObject({ code: 'WH-NYC', isActive: true });

    const london = await createWarehouse({
      code: 'WH-LON',
      name: 'London Fulfilment Hub',
      city: 'London',
      country: 'United Kingdom',
    }).expect(201);
    londonId = london.body.id;
    expect(london.body.address).toBeNull();
  });

  it('rejects a duplicate code and invalid input', async () => {
    const duplicate = await createWarehouse({
      code: 'WH-NYC',
      name: 'Copy',
      city: 'New York',
      country: 'United States',
    }).expect(409);
    expect(duplicate.body.error).toBe('WAREHOUSE_CODE_TAKEN');

    const invalid = await createWarehouse({ code: 'no spaces', name: '' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toBe('VALIDATION_FAILED');
  });

  it('lists with pagination metadata and searches code, name and city', async () => {
    const all = await http
      .get('/warehouses')
      .set('Authorization', staff)
      .expect(200);
    expect(all.body.meta).toMatchObject({ total: 2, totalPages: 1 });
    expect(all.body.data.map((row: { code: string }) => row.code)).toEqual([
      'WH-LON',
      'WH-NYC',
    ]);

    const byCity = await http
      .get('/warehouses?search=york')
      .set('Authorization', staff)
      .expect(200);
    expect(byCity.body.data).toHaveLength(1);
    expect(byCity.body.data[0].code).toBe('WH-NYC');
  });

  it('adds storage locations, unique per warehouse', async () => {
    const created = await http
      .post(`/warehouses/${nycId}/locations`)
      .set('Authorization', manager)
      .send({ code: 'a-01-03', description: 'Aisle A, rack 1, shelf 3' })
      .expect(201);
    locationId = created.body.id;
    expect(created.body).toMatchObject({ warehouseId: nycId, code: 'A-01-03' });

    const duplicate = await http
      .post(`/warehouses/${nycId}/locations`)
      .set('Authorization', manager)
      .send({ code: 'A-01-03' })
      .expect(409);
    expect(duplicate.body.error).toBe('LOCATION_CODE_TAKEN');

    // The same code is fine in a different warehouse.
    await http
      .post(`/warehouses/${londonId}/locations`)
      .set('Authorization', manager)
      .send({ code: 'A-01-03' })
      .expect(201);
  });

  it("lists only the requested warehouse's locations", async () => {
    const response = await http
      .get(`/warehouses/${nycId}/locations`)
      .set('Authorization', staff)
      .expect(200);

    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0].id).toBe(locationId);
  });

  it("does not expose a location through another warehouse's URL", async () => {
    await http
      .get(`/warehouses/${londonId}/locations/${locationId}`)
      .set('Authorization', staff)
      .expect(404);
    await http
      .delete(`/warehouses/${londonId}/locations/${locationId}`)
      .set('Authorization', manager)
      .expect(404);
  });

  it('answers 404 for locations of an unknown warehouse', async () => {
    await http
      .get('/warehouses/00000000-0000-4000-8000-00000000dead/locations')
      .set('Authorization', staff)
      .expect(404);
  });

  it('updates and deletes a storage location', async () => {
    const updated = await http
      .patch(`/warehouses/${nycId}/locations/${locationId}`)
      .set('Authorization', manager)
      .send({ description: 'Moved' })
      .expect(200);
    expect(updated.body).toMatchObject({
      code: 'A-01-03',
      description: 'Moved',
    });

    await http
      .delete(`/warehouses/${nycId}/locations/${locationId}`)
      .set('Authorization', manager)
      .expect(204);
    await http
      .get(`/warehouses/${nycId}/locations/${locationId}`)
      .set('Authorization', staff)
      .expect(404);
  });

  it('archives a warehouse instead of deleting it, and can restore it', async () => {
    await http
      .delete(`/warehouses/${londonId}`)
      .set('Authorization', manager)
      .expect(204);

    const active = await http
      .get('/warehouses?isActive=true')
      .set('Authorization', staff)
      .expect(200);
    expect(active.body.meta.total).toBe(1);

    const restored = await http
      .patch(`/warehouses/${londonId}`)
      .set('Authorization', manager)
      .send({ isActive: true })
      .expect(200);
    expect(restored.body.isActive).toBe(true);
  });
});
