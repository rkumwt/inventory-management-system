import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Category } from '../categories/category.entity';
import { PRODUCT_ENV, ProductEnv } from '../config/env.schema';
import { Product } from '../products/product.entity';
import { SEED_CATEGORIES, SEED_PRODUCTS } from './seed-data';

/**
 * Inserts sample categories and products when SEED_DATA=true so the app has
 * something to show right after `pnpm dev`. Idempotent: rows that already
 * exist (same id, name or SKU) are skipped, so local edits are never undone.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(PRODUCT_ENV) private readonly config: Pick<ProductEnv, 'SEED_DATA'>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.SEED_DATA) return;

    const categories = await this.insertMissing(Category, SEED_CATEGORIES);
    const products = await this.insertMissing(Product, SEED_PRODUCTS);
    if (categories + products > 0) {
      this.logger.log(`Seeded ${categories} categories, ${products} products`);
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
