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
  /** Extra attempts after a failure. Lookups are GETs, so retrying is safe. */
  retries: number;
  /** Base backoff; doubles on each retry. */
  retryDelayMs: number;
}

type Resource = 'product' | 'warehouse';

/**
 * Synchronous lookups in the services that own products and warehouses.
 *
 * inventory-service stores only their IDs. Before it records stock for a
 * product/warehouse pair for the first time, it asks the owning service
 * whether the ID exists and is still active. The caller's access token is
 * passed along, so the owning service applies its own permission check.
 *
 * Every call has a timeout and is retried with exponential backoff. If the
 * owning service still cannot be reached, the request fails with 503 rather
 * than recording stock for something that may not exist.
 */
@Injectable()
export class CatalogClient {
  private readonly logger = new Logger(CatalogClient.name);

  constructor(
    @Inject(CATALOG_OPTIONS) private readonly options: CatalogOptions,
  ) {}

  assertProductUsable(id: string, authorization: string): Promise<void> {
    return this.assertUsable(
      'product',
      `${this.options.productServiceUrl}/products/${id}`,
      id,
      authorization,
    );
  }

  assertWarehouseUsable(id: string, authorization: string): Promise<void> {
    return this.assertUsable(
      'warehouse',
      `${this.options.warehouseServiceUrl}/warehouses/${id}`,
      id,
      authorization,
    );
  }

  private async assertUsable(
    resource: Resource,
    url: string,
    id: string,
    authorization: string,
  ): Promise<void> {
    const response = await this.get(resource, url, authorization);
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

    const body = (await response.json()) as { isActive?: boolean };
    if (body.isActive === false) {
      throw new BadRequestException({
        error: `${code}_ARCHIVED`,
        message: `The ${resource} ${id} is archived`,
      });
    }
  }

  private async get(
    resource: Resource,
    url: string,
    authorization: string,
  ): Promise<Response> {
    const headers: Record<string, string> = { authorization };
    const correlationId = getCorrelationId();
    if (correlationId) headers[CORRELATION_ID_HEADER] = correlationId;

    try {
      return await fetchWithRetry(
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
  }
}

function unavailable(resource: Resource): ServiceUnavailableException {
  return new ServiceUnavailableException({
    error: 'CATALOG_UNAVAILABLE',
    message: `Could not verify the ${resource} right now; please try again`,
  });
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
