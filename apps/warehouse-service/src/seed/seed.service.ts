import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { StorageLocation } from '../locations/storage-location.entity';
import { WAREHOUSE_ENV, WarehouseEnv } from '../config/env.schema';
import { Warehouse } from '../warehouses/warehouse.entity';
import { SEED_LOCATIONS, SEED_WAREHOUSES } from './seed-data';

/**
 * Inserts sample warehouses and storage locations when SEED_DATA=true so the app has
 * something to show right after `pnpm dev`. Idempotent: rows that already
 * exist (same id or code) are skipped, so local edits are never undone.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(WAREHOUSE_ENV)
    private readonly config: Pick<WarehouseEnv, 'SEED_DATA'>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.SEED_DATA) return;

    const warehouses = await this.insertMissing(Warehouse, SEED_WAREHOUSES);
    const locations = await this.insertMissing(StorageLocation, SEED_LOCATIONS);
    if (warehouses + locations > 0) {
      this.logger.log(
        `Seeded ${warehouses} warehouses, ${locations} storage locations`,
      );
    }
  }

  private async insertMissing<T extends object>(
    entity: new () => T,
    rows: object[],
  ): Promise<number> {
    const result = await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(entity)
      .values(rows as never)
      .orIgnore() // ON CONFLICT DO NOTHING
      .execute();
    return (result.raw as unknown[]).length;
  }
}
