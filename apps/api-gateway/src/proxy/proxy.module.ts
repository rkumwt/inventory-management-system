import { Module } from '@nestjs/common';
import { env } from '../config/env';
import { ProxyController, PublicAuthProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';
import {
  UPSTREAM_OPTIONS,
  UpstreamClient,
  UpstreamOptions,
} from './upstream.client';

const upstreamOptions: UpstreamOptions = {
  baseUrls: {
    auth: env.AUTH_SERVICE_URL,
    product: env.PRODUCT_SERVICE_URL,
    warehouse: env.WAREHOUSE_SERVICE_URL,
    inventory: env.INVENTORY_SERVICE_URL,
    order: env.ORDER_SERVICE_URL,
    notification: env.NOTIFICATION_SERVICE_URL,
  },
  timeoutMs: env.UPSTREAM_TIMEOUT_MS,
  retries: env.UPSTREAM_RETRIES,
  retryDelayMs: 100,
};

@Module({
  // Order matters: specific public routes first, catch-all last.
  controllers: [PublicAuthProxyController, ProxyController],
  providers: [
    { provide: UPSTREAM_OPTIONS, useValue: upstreamOptions },
    UpstreamClient,
    ProxyService,
  ],
})
export class ProxyModule {}
