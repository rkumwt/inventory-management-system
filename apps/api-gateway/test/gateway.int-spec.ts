import {
  AccessTokenClaims,
  configureHttpApp,
  Permission,
  Role,
} from '@ims/common';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import { createServer, IncomingMessage, Server } from 'node:http';
import request from 'supertest';
import { STUB_UPSTREAM_PORT } from './setup-env';

interface SeenRequest {
  method?: string;
  url?: string;
  headers: IncomingMessage['headers'];
  body: string;
}

/**
 * Boots the real gateway with real Redis-backed rate limiting, in front of a
 * stub HTTP server standing in for auth-service.
 */
describe('api-gateway (integration)', () => {
  let app: INestApplication;
  let upstream: Server;
  let http: ReturnType<typeof request>;
  let accessToken: string;
  const seen: SeenRequest[] = [];

  beforeAll(async () => {
    upstream = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        seen.push({
          method: req.method,
          url: req.url,
          headers: req.headers,
          body,
        });
        res.writeHead(req.url === '/users/missing' ? 404 : 200, {
          'content-type': 'application/json',
        });
        res.end(JSON.stringify({ from: 'stub', url: req.url }));
      });
    });
    await new Promise<void>((resolve) =>
      upstream.listen(STUB_UPSTREAM_PORT, '127.0.0.1', resolve),
    );

    // Imported lazily so the env from setup-env.ts is in place first.
    const { AppModule } = await import('../src/app.module');
    const { REDIS_CLIENT } = await import('../src/redis/redis.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    configureHttpApp(app, {
      serviceName: 'api-gateway',
      globalPrefix: { prefix: 'v1', exclude: ['health'] },
    });
    await app.init();
    await app.get<Redis>(REDIS_CLIENT).flushdb(); // reset rate-limit counters

    const claims: AccessTokenClaims = {
      sub: 'user-1',
      email: 'admin@ims.local',
      role: Role.Admin,
      permissions: [Permission.UsersManage],
    };
    accessToken = await app
      .get(JwtService)
      .signAsync(claims, { expiresIn: 60 });
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app?.close();
    await new Promise((resolve) => upstream?.close(resolve));
  });

  beforeEach(() => {
    seen.length = 0;
  });

  it('reports healthy when Redis is reachable', async () => {
    const response = await http.get('/health').expect(200);

    expect(response.body.details.redis.status).toBe('up');
  });

  it('rejects protected routes without a token, before calling upstream', async () => {
    const response = await http.get('/v1/users').expect(401);

    expect(response.body.error).toBe('UNAUTHORIZED');
    expect(seen).toHaveLength(0);
  });

  it('forwards an authenticated request with token and correlation ID', async () => {
    const response = await http
      .get('/v1/users?page=2')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-correlation-id', 'int-test-1')
      .expect(200);

    expect(response.body).toEqual({ from: 'stub', url: '/users?page=2' });
    expect(response.headers['x-correlation-id']).toBe('int-test-1');
    expect(seen[0]?.headers).toMatchObject({
      authorization: `Bearer ${accessToken}`,
      'x-correlation-id': 'int-test-1',
    });
  });

  it('passes upstream errors through unchanged', async () => {
    await http
      .get('/v1/users/missing')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('answers 404 for paths no service owns', async () => {
    await http
      .get('/v1/unknown')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
    expect(seen).toHaveLength(0);
  });

  it('lets public auth routes through, then rate-limits them', async () => {
    const login = () =>
      http.post('/v1/auth/login').send({ email: 'a@b.co', password: 'x' });

    for (let attempt = 1; attempt <= 3; attempt++) {
      await login().expect(200);
    }
    const limited = await login().expect(429);

    expect(limited.body.error).toBe('TOO_MANY_REQUESTS');
    expect(seen).toHaveLength(3);
    expect(seen[0]).toMatchObject({
      method: 'POST',
      url: '/auth/login',
      body: '{"email":"a@b.co","password":"x"}',
    });
  });
});
