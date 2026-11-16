import { Module } from '@nestjs/common';
import { env } from '../config/env';
import {
  CATALOG_OPTIONS,
  CatalogClient,
  CatalogOptions,
} from './catalog.client';

const catalogOptions: CatalogOptions = {
  productServiceUrl: env.PRODUCT_SERVICE_URL,
  warehouseServiceUrl: env.WAREHOUSE_SERVICE_URL,
  timeoutMs: env.UPSTREAM_TIMEOUT_MS,
  retries: env.UPSTREAM_RETRIES,
  retryDelayMs: 100,
};

@Module({
  providers: [
    { provide: CATALOG_OPTIONS, useValue: catalogOptions },
    CatalogClient,
  ],
  exports: [CatalogClient],
})
export class CatalogModule {}
