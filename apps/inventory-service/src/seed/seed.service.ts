import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { INVENTORY_ENV, InventoryEnv } from '../config/env.schema';
import { StockItem } from '../stock/stock-item.entity';
import { MovementType, StockMovement } from '../stock/stock-movement.entity';
import { SEED_STOCK } from './seed-data';

/**
 * Inserts opening stock levels when SEED_DATA=true, each with an "opening
 * balance" movement so the history adds up. Runs only while the stock table
 * is empty, so it never touches real data.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(INVENTORY_ENV)
    private readonly config: Pick<InventoryEnv, 'SEED_DATA'>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.SEED_DATA) return;

    await this.dataSource.transaction(async (manager) => {
      if (await manager.exists(StockItem)) return;

      const items = await manager.save(
        SEED_STOCK.map((row) => manager.create(StockItem, row)),
      );
      await manager.save(
        items.map((item) =>
          manager.create(StockMovement, {
            stockItemId: item.id,
            productId: item.productId,
            warehouseId: item.warehouseId,
            type: MovementType.In,
            quantity: item.quantity,
            quantityAfter: item.quantity,
            reference: 'OPENING-BALANCE',
            note: 'Seed data',
          }),
        ),
      );
      this.logger.log(`Seeded ${items.length} stock items`);
    });
  }
}
