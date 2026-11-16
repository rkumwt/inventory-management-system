import {
  CORRELATION_ID_HEADER,
  fetchWithRetry,
  getCorrelationId,
} from '@ims/common';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

export const CATALOG_OPTIONS = Symbol('CATALOG_OPTIONS');

export interface CatalogOptions {
  productServiceUrl: string;
  warehouseServiceUrl: string;
  timeoutMs: number;
  retries: number;
  retryDelayMs: number;
}

/** What order-service needs to know about a product to put it on an order. */
export interface CatalogProduct {
  id: string;
  sku: string;
  name: string;
  price: number;
}

type Resource = 'product' | 'warehouse';

/**
 * Synchronous lookups made while an order is being placed: the current SKU,
 * name and price of each product (from product-service) and whether the
 * warehouse is active (from warehouse-service). The caller's access token is
 * passed along. Calls have a timeout and are retried with backoff; if the
 * answer cannot be obtained the order is refused with 503, not guessed.
 *
 * Stock is NOT checked here. That happens asynchronously, in the saga.
 */
@Injectable()
export class CatalogClient {
  private readonly logger = new Logger(CatalogClient.name);

  constructor(
    @Inject(CATALOG_OPTIONS) private readonly options: CatalogOptions,
  ) {}

  async getProduct(id: string, authorization: string): Promise<CatalogProduct> {
    const body = await this.getActive<CatalogProduct>(
      'product',
      `${this.options.productServiceUrl}/products/${id}`,
      id,
      authorization,
    );
    return { id: body.id, sku: body.sku, name: body.name, price: body.price };
  }

  async assertWarehouseUsable(
    id: string,
    authorization: string,
  ): Promise<void> {
    await this.getActive(
      'warehouse',
      `${this.options.warehouseServiceUrl}/warehouses/${id}`,
      id,
      authorization,
    );
  }

  private async getActive<T>(
    resource: Resource,
    url: string,
    id: string,
    authorization: string,
  ): Promise<T> {
    const headers: Record<string, string> = { authorization };
    const correlationId = getCorrelationId();
    if (correlationId) headers[CORRELATION_ID_HEADER] = correlationId;

    let response: Response;
    try {
      response = await fetchWithRetry(
        url,
        { headers },
        {
          ...this.options,
          onRetry: (attempt, attempts, error) =>
            this.logger.warn(
              `${resource} lookup failed (attempt ${attempt}/${attempts}): ${describe(error)}`,
            ),
        },
      );
    } catch (error) {
      this.logger.error(`${resource} lookup unavailable: ${describe(error)}`);
      throw unavailable(resource);
    }

    const code = resource.toUpperCase();
    if (response.status === 404) {
      throw new BadRequestException({
        error: `${code}_NOT_FOUND`,
        message: `The ${resource} ${id} does not exist`,
      });
    }
    if (!response.ok) {
      this.logger.error(`${resource} lookup answered HTTP ${response.status}`);
      throw unavailable(resource);
    }

    const body = (await response.json()) as T & { isActive?: boolean };
    if (body.isActive === false) {
      throw new BadRequestException({
        error: `${code}_ARCHIVED`,
        message: `The ${resource} ${id} is archived`,
      });
    }
    return body;
  }
}

function unavailable(resource: Resource): ServiceUnavailableException {
  return new ServiceUnavailableException({
    error: 'CATALOG_UNAVAILABLE',
    message: `Could not look up the ${resource} right now; please try again`,
  });
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
