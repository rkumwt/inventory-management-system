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
describe('product-service (integration)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let manager: string;
  let staff: string;
  let toolsId: string;
  let drillId: string;

  const tokenFor = (role: Role) =>
    `Bearer ${app.get(JwtService).sign({
      sub: '00000000-0000-4000-8000-000000000001',
      email: `${role.toLowerCase()}@ims.local`,
      role,
      permissions: permissionsForRole(role),
    })}`;

  const createProduct = (body: object) =>
    http.post('/products').set('Authorization', manager).send(body);

  beforeAll(async () => {
    await ensureTestDatabase();
    // Imported lazily so the env from setup-env.ts is in place first.
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    configureHttpApp(app, { serviceName: 'product-service' });
    await app.init();

    await app.get(DataSource).query('TRUNCATE TABLE products, categories');
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
    const response = await http.get('/products').expect(401);

    expect(response.body.error).toBe('UNAUTHORIZED');
  });

  it('lets staff read but not write', async () => {
    await http.get('/products').set('Authorization', staff).expect(200);

    const response = await http
      .post('/categories')
      .set('Authorization', staff)
      .send({ name: 'Nope' })
      .expect(403);
    expect(response.body.error).toBe('FORBIDDEN');
  });

  it('creates categories and rejects a duplicate name, ignoring case', async () => {
    const created = await http
      .post('/categories')
      .set('Authorization', manager)
      .send({ name: 'Power Tools', description: 'Corded and cordless' })
      .expect(201);
    toolsId = created.body.id;

    const duplicate = await http
      .post('/categories')
      .set('Authorization', manager)
      .send({ name: 'power tools' })
      .expect(409);
    expect(duplicate.body.error).toBe('CATEGORY_NAME_TAKEN');
  });

  it('creates a product, upper-casing the SKU and embedding its category', async () => {
    const response = await createProduct({
      sku: 'drl-18v-001',
      name: 'Cordless Drill 18V',
      price: 129.99,
      unit: 'pcs',
      attributes: { voltage: 18, color: 'blue' },
      categoryId: toolsId,
    }).expect(201);
    drillId = response.body.id;

    expect(response.body).toMatchObject({
      sku: 'DRL-18V-001',
      price: 129.99,
      attributes: { voltage: 18, color: 'blue' },
      category: { id: toolsId, name: 'Power Tools' },
      isActive: true,
    });
  });

  it('rejects a duplicate SKU with 409', async () => {
    const response = await createProduct({
      sku: 'DRL-18V-001',
      name: 'Another drill',
      price: 1,
      unit: 'pcs',
    }).expect(409);

    expect(response.body.error).toBe('SKU_ALREADY_EXISTS');
  });

  it('rejects invalid input and unknown categories with 400', async () => {
    const invalid = await createProduct({
      sku: 'bad sku',
      name: '',
      price: -5,
      unit: 'dozen',
    }).expect(400);
    expect(invalid.body.error).toBe('VALIDATION_FAILED');

    const unknownCategory = await createProduct({
      sku: 'X-1',
      name: 'Orphan',
      price: 1,
      unit: 'pcs',
      categoryId: '00000000-0000-4000-8000-00000000dead',
    }).expect(400);
    expect(unknownCategory.body.error).toBe('CATEGORY_NOT_FOUND');
  });

  describe('listing', () => {
    beforeAll(async () => {
      await createProduct({
        sku: 'SAW-CIR-185',
        name: 'Circular Saw',
        price: 159.5,
        unit: 'pcs',
        attributes: { color: 'red' },
        categoryId: toolsId,
      }).expect(201);
      await createProduct({
        sku: 'GLV-NTR-L',
        name: 'Nitrile Gloves',
        price: 6.5,
        unit: 'pack',
        attributes: { color: 'blue', size: 'L' },
      }).expect(201);
    });

    const skus = async (query: string) => {
      const response = await http
        .get(`/products?${query}`)
        .set('Authorization', staff)
        .expect(200);
      return (response.body.data as { sku: string }[]).map((row) => row.sku);
    };

    it('paginates with stable metadata', async () => {
      const response = await http
        .get('/products?limit=2&page=2')
        .set('Authorization', staff)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta).toEqual({
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
        hasNextPage: false,
        hasPreviousPage: true,
      });
    });

    it('searches SKU and name, case-insensitively', async () => {
      expect(await skus('search=saw')).toEqual(['SAW-CIR-185']);
      expect(await skus('search=gloves')).toEqual(['GLV-NTR-L']);
    });

    it('filters by category and price range', async () => {
      expect(await skus(`categoryId=${toolsId}&sortBy=sku`)).toEqual([
        'DRL-18V-001',
        'SAW-CIR-185',
      ]);
      expect(await skus('minPrice=100&maxPrice=150')).toEqual(['DRL-18V-001']);
    });

    it('filters by JSONB attributes', async () => {
      const blue = encodeURIComponent('{"color":"blue"}');
      const blueLarge = encodeURIComponent('{"color":"blue","size":"L"}');

      expect(await skus(`attributes=${blue}&sortBy=sku`)).toEqual([
        'DRL-18V-001',
        'GLV-NTR-L',
      ]);
      expect(await skus(`attributes=${blueLarge}`)).toEqual(['GLV-NTR-L']);
    });

    it('sorts by an allowed field', async () => {
      expect(await skus('sortBy=price&sortOrder=desc')).toEqual([
        'SAW-CIR-185',
        'DRL-18V-001',
        'GLV-NTR-L',
      ]);
    });

    it('rejects unknown query parameters', async () => {
      await http
        .get('/products?sortBy=password')
        .set('Authorization', staff)
        .expect(400);
      await http
        .get('/products?unknown=1')
        .set('Authorization', staff)
        .expect(400);
    });
  });

  it('updates a product and can move it out of its category', async () => {
    const response = await http
      .patch(`/products/${drillId}`)
      .set('Authorization', manager)
      .send({ price: 119, categoryId: null })
      .expect(200);

    expect(response.body).toMatchObject({
      sku: 'DRL-18V-001',
      price: 119,
      category: null,
    });
  });

  it('refuses to delete a category that still has products', async () => {
    const response = await http
      .delete(`/categories/${toolsId}`)
      .set('Authorization', manager)
      .expect(409);

    expect(response.body.error).toBe('CATEGORY_IN_USE');
  });

  it('archives a product instead of deleting it', async () => {
    await http
      .delete(`/products/${drillId}`)
      .set('Authorization', manager)
      .expect(204);

    const archived = await http
      .get(`/products/${drillId}`)
      .set('Authorization', staff)
      .expect(200);
    expect(archived.body.isActive).toBe(false);

    const active = await http
      .get('/products?isActive=true')
      .set('Authorization', staff)
      .expect(200);
    expect(active.body.meta.total).toBe(2);
  });

  it('answers 404 for an unknown product and 400 for a malformed id', async () => {
    await http
      .get('/products/00000000-0000-4000-8000-00000000dead')
      .set('Authorization', staff)
      .expect(404);
    await http
      .get('/products/not-a-uuid')
      .set('Authorization', staff)
      .expect(400);
  });
});
