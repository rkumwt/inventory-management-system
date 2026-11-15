import { CORRELATION_ID_HEADER, getCorrelationId } from '@ims/common';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { resolveRoute } from './routes';
import { UpstreamClient } from './upstream.client';

const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD', 'DELETE', 'OPTIONS']);

/** Forwards an incoming request to the service that owns its path. */
@Injectable()
export class ProxyService {
  constructor(private readonly upstream: UpstreamClient) {}

  async forward(req: Request, res: Response): Promise<void> {
    const route = resolveRoute(req.originalUrl);
    if (!route) {
      throw new NotFoundException(`Cannot ${req.method} ${req.originalUrl}`);
    }

    const hasBody =
      !METHODS_WITHOUT_BODY.has(req.method) && req.body !== undefined;

    // Only an explicit allow-list of headers crosses the gateway.
    const headers: Record<string, string> = { accept: 'application/json' };
    if (req.headers.authorization) {
      headers['authorization'] = req.headers.authorization;
    }
    const correlationId = getCorrelationId();
    if (correlationId) headers[CORRELATION_ID_HEADER] = correlationId;
    if (req.ip) headers['x-forwarded-for'] = req.ip;
    if (hasBody) headers['content-type'] = 'application/json';

    const response = await this.upstream.send({
      upstream: route.upstream,
      method: req.method,
      path: route.path,
      headers,
      body: hasBody ? JSON.stringify(req.body) : undefined,
    });

    res.status(response.status);
    if (response.contentType)
      res.setHeader('content-type', response.contentType);
    res.send(response.body);
  }
}
