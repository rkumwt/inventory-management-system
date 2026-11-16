import { configureHttpApp, Role } from '@ims/common';
import { ensureTestDatabase } from '@ims/database';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';

/**
 * Boots the real AppModule against a real PostgreSQL database (migrations
 * included) and drives it over HTTP.
 */
describe('auth-service (integration)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  const account = {
    email: 'Int.Test@ims.local',
    name: 'Integration Test',
    password: 'integration-password-1',
  };

  beforeAll(async () => {
    await ensureTestDatabase();
    // Imported lazily so the env from setup-env.ts is in place first.
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    configureHttpApp(app, { serviceName: 'auth-service' });
    await app.init();

    await app
      .get(DataSource)
      .query('TRUNCATE TABLE refresh_tokens, users CASCADE');
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app?.close();
  });

  it('reports healthy when the database is reachable', async () => {
    const response = await http.get('/health').expect(200);

    expect(response.body.details.database.status).toBe('up');
  });

  it('registers a STAFF user without exposing the password hash', async () => {
    const response = await http
      .post('/auth/register')
      .send({ ...account, role: undefined })
      .expect(201);

    expect(response.body).toMatchObject({
      email: 'int.test@ims.local',
      name: 'Integration Test',
      role: Role.Staff,
      isActive: true,
    });
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('rejects unknown properties such as a self-assigned role', async () => {
    const response = await http
      .post('/auth/register')
      .send({ ...account, email: 'other@ims.local', role: Role.Admin })
      .expect(400);

    expect(response.body.error).toBe('VALIDATION_FAILED');
  });

  it('rejects a duplicate email with 409', async () => {
    const response = await http
      .post('/auth/register')
      .send(account)
      .expect(409);

    expect(response.body.error).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('runs the full session lifecycle: login, me, refresh, reuse, logout', async () => {
    const login = await http
      .post('/auth/login')
      .send({ email: account.email, password: account.password })
      .expect(200);
    const { accessToken, refreshToken } = login.body;

    const me = await http
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body.email).toBe('int.test@ims.local');

    const refreshed = await http
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    expect(refreshed.body.refreshToken).not.toBe(refreshToken);

    // The first refresh token was rotated out; presenting it again is refused
    // and revokes the whole session family.
    const reuse = await http
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
    expect(reuse.body.error).toBe('REFRESH_TOKEN_REVOKED');
    await http
      .post('/auth/refresh')
      .send({ refreshToken: refreshed.body.refreshToken })
      .expect(401);

    const second = await http
      .post('/auth/login')
      .send({ email: account.email, password: account.password })
      .expect(200);
    await http
      .post('/auth/logout')
      .send({ refreshToken: second.body.refreshToken })
      .expect(204);
    await http
      .post('/auth/refresh')
      .send({ refreshToken: second.body.refreshToken })
      .expect(401);
  });

  it('answers a wrong password with a generic 401', async () => {
    const response = await http
      .post('/auth/login')
      .send({ email: account.email, password: 'wrong-password' })
      .expect(401);

    expect(response.body).toMatchObject({
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
  });

  it('requires a token for /auth/me and admin permission for /users', async () => {
    await http.get('/auth/me').expect(401);

    const login = await http
      .post('/auth/login')
      .send({ email: account.email, password: account.password })
      .expect(200);
    const response = await http
      .get('/users')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(403);

    expect(response.body.error).toBe('FORBIDDEN');
  });
});
