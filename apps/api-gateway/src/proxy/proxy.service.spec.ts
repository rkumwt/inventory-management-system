import { runWithCorrelationId } from '@ims/common';
import { NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import { resolveRoute } from './routes';
import { UpstreamClient } from './upstream.client';

function setup() {
  const send = jest.fn().mockResolvedValue({
    status: 201,
    contentType: 'application/json; charset=utf-8',
    body: '{"id":"1"}',
  });
  const res = {
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
    send: jest.fn(),
  };
  const service = new ProxyService({ send } as unknown as UpstreamClient);
  return { service, send, res, response: res as unknown as Response };
}

const request = (overrides: Partial<Request>) =>
  ({
    method: 'GET',
    originalUrl: '/v1/users?page=2',
    headers: {},
    ip: '10.0.0.7',
    ...overrides,
  }) as Request;

describe('resolveRoute', () => {
  it.each([
    ['/v1/auth/login', { upstream: 'auth', path: '/auth/login' }],
    ['/v1/users?page=2', { upstream: 'auth', path: '/users?page=2' }],
    ['/v1/users/42/role', { upstream: 'auth', path: '/users/42/role' }],
    ['/v1/categories', { upstream: 'product', path: '/categories' }],
    [
      '/v1/inventory/stock-in',
      { upstream: 'inventory', path: '/inventory/stock-in' },
    ],
    [
      '/v1/products?search=drill',
      { upstream: 'product', path: '/products?search=drill' },
    ],
    [
      '/v1/warehouses/7/locations',
      { upstream: 'warehouse', path: '/warehouses/7/locations' },
    ],
  ])('maps %s', (url, expected) => {
    expect(resolveRoute(url)).toEqual(expected);
  });

  it.each(['/v1/unknown', '/v2/users', '/users', '/v1/', '/v1/usersx'])(
    'does not map %s',
    (url) => {
      expect(resolveRoute(url)).toBeUndefined();
    },
  );
});

describe('ProxyService', () => {
  it('forwards method, path, token, correlation ID and JSON body', async () => {
    const { service, send, res, response } = setup();
    const req = request({
      method: 'PATCH',
      originalUrl: '/v1/users/42/role',
      headers: { authorization: 'Bearer token-abc', cookie: 'session=secret' },
      body: { role: 'MANAGER' },
    });

    await runWithCorrelationId('corr-9', () => service.forward(req, response));

    expect(send).toHaveBeenCalledWith({
      upstream: 'auth',
      method: 'PATCH',
      path: '/users/42/role',
      headers: {
        accept: 'application/json',
        authorization: 'Bearer token-abc',
        'x-correlation-id': 'corr-9',
        'x-forwarded-for': '10.0.0.7',
        'content-type': 'application/json',
      },
      body: '{"role":"MANAGER"}',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.setHeader).toHaveBeenCalledWith(
      'content-type',
      'application/json; charset=utf-8',
    );
    expect(res.send).toHaveBeenCalledWith('{"id":"1"}');
  });

  it('sends no body and no content-type for GET requests', async () => {
    const { service, send, response } = setup();

    await service.forward(request({ body: {} }), response);

    const sent = send.mock.calls[0][0];
    expect(sent.body).toBeUndefined();
    expect(sent.headers).not.toHaveProperty('content-type');
    expect(sent.headers).not.toHaveProperty('authorization');
  });

  it('answers 404 for paths no service owns', async () => {
    const { service, send, response } = setup();

    await expect(
      service.forward(request({ originalUrl: '/v1/nope' }), response),
    ).rejects.toThrow(NotFoundException);
    expect(send).not.toHaveBeenCalled();
  });
});
