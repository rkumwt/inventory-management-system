import { getCorrelationId, Paginated, paginate, toSkip } from '@ims/common';
import { addToOutbox } from '@ims/database';
import { createEvent, EventName } from '@ims/events';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { CatalogClient } from '../catalog/catalog.client';
import {
  AdjustStockDto,
  MovementQueryDto,
  StockQueryDto,
  TransferStockDto,
} from './dto/stock.dto';
import { VersionConflictError, withOptimisticRetry } from './optimistic-retry';
import { StockItem } from './stock-item.entity';
import { MovementType, StockMovement } from './stock-movement.entity';
import {
  availableQuantity,
  crossedLowStockThreshold,
  quantityAfterStockIn,
  quantityAfterStockOut,
  StockRuleError,
} from './stock-rules';

/** The event announcing that an item just dropped to or below its threshold. */
export function lowStockEvent(
  item: Pick<
    StockItem,
    | 'productId'
    | 'warehouseId'
    | 'quantity'
    | 'reservedQuantity'
    | 'lowStockThreshold'
  >,
  correlationId: string | undefined,
) {
  return createEvent(
    EventName.LowStockDetected,
    {
      productId: item.productId,
      warehouseId: item.warehouseId,
      availableQuantity: availableQuantity(item),
      threshold: item.lowStockThreshold,
    },
    correlationId ?? randomUUID(),
  );
}

/** Who is making the change, and the token to act on their behalf with. */
export interface Actor {
  userId: string;
  authorization: string;
}

export interface StockChange {
  stock: StockItem;
  movement: StockMovement;
}

export interface TransferResult {
  transferId: string;
  source: StockItem;
  destination: StockItem;
}

interface MovementDetails {
  reference?: string;
  note?: string;
  transferId?: string;
}

/**
 * Changes stock levels and records every change as a movement.
 *
 * Concurrency: two requests may read the same stock item at the same time.
 * Each write is `UPDATE ... WHERE id = ? AND version = ?`, so only the first
 * one succeeds; the other sees zero rows updated, and the whole operation is
 * retried from a fresh read (optimistic locking). The level and its movement
 * rows are written in one transaction, so they can never disagree.
 */
@Injectable()
export class StockService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly catalog: CatalogClient,
  ) {}

  async list(query: StockQueryDto): Promise<Paginated<StockItem>> {
    const qb = this.dataSource
      .getRepository(StockItem)
      .createQueryBuilder('stock');

    if (query.productId) {
      qb.andWhere('stock.productId = :productId', {
        productId: query.productId,
      });
    }
    if (query.warehouseId) {
      qb.andWhere('stock.warehouseId = :warehouseId', {
        warehouseId: query.warehouseId,
      });
    }
    if (query.lowStock !== undefined) {
      const comparison = query.lowStock ? '<=' : '>';
      qb.andWhere(
        `stock.quantity - stock.reservedQuantity ${comparison} stock.lowStockThreshold`,
      );
    }

    const [rows, total] = await qb
      .orderBy('stock.updatedAt', 'DESC')
      .addOrderBy('stock.id', 'ASC')
      .skip(toSkip(query))
      .take(query.limit)
      .getManyAndCount();
    return paginate(rows, total, query);
  }

  async getById(id: string): Promise<StockItem> {
    const item = await this.dataSource
      .getRepository(StockItem)
      .findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Stock item ${id} not found`);
    return item;
  }

  async listMovements(
    query: MovementQueryDto,
  ): Promise<Paginated<StockMovement>> {
    const [rows, total] = await this.dataSource
      .getRepository(StockMovement)
      .findAndCount({
        where: {
          ...(query.productId && { productId: query.productId }),
          ...(query.warehouseId && { warehouseId: query.warehouseId }),
          ...(query.type && { type: query.type }),
        },
        order: { createdAt: 'DESC', id: 'ASC' },
        skip: toSkip(query),
        take: query.limit,
      });
    return paginate(rows, total, query);
  }

  async stockIn(dto: AdjustStockDto, actor: Actor): Promise<StockChange> {
    await this.ensureStockItem(dto.productId, dto.warehouseId, actor);

    return this.attempt((manager) =>
      this.change(manager, dto, MovementType.In, actor, dto),
    );
  }

  stockOut(dto: AdjustStockDto, actor: Actor): Promise<StockChange> {
    return this.attempt((manager) =>
      this.change(manager, dto, MovementType.Out, actor, dto),
    );
  }

  async transfer(dto: TransferStockDto, actor: Actor): Promise<TransferResult> {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException({
        error: 'SAME_WAREHOUSE',
        message: 'Source and destination warehouse must be different',
      });
    }
    await this.ensureStockItem(dto.productId, dto.toWarehouseId, actor);

    const transferId = randomUUID();
    const details = { ...dto, transferId };

    const leg = (warehouseId: string, type: MovementType) => ({
      warehouseId,
      type,
      target: { productId: dto.productId, warehouseId, quantity: dto.quantity },
    });
    // Rows are always locked in the same (warehouse ID) order, so a transfer
    // A -> B and a simultaneous B -> A cannot deadlock each other.
    const legs = [
      leg(dto.fromWarehouseId, MovementType.TransferOut),
      leg(dto.toWarehouseId, MovementType.TransferIn),
    ].sort((a, b) => a.warehouseId.localeCompare(b.warehouseId));

    // Both sides in one transaction: the stock leaves and arrives, or neither.
    return this.attempt(async (manager) => {
      const stock = new Map<MovementType, StockItem>();
      for (const { type, target } of legs) {
        const change = await this.change(manager, target, type, actor, details);
        stock.set(type, change.stock);
      }
      return {
        transferId,
        source: stock.get(MovementType.TransferOut) as StockItem,
        destination: stock.get(MovementType.TransferIn) as StockItem,
      };
    });
  }

  async setThreshold(
    id: string,
    lowStockThreshold: number,
  ): Promise<StockItem> {
    // Touches neither quantity nor version, so it cannot disturb a
    // concurrent stock change and needs no version check of its own.
    const result = await this.dataSource
      .getRepository(StockItem)
      .update({ id }, { lowStockThreshold });
    if (!result.affected) {
      throw new NotFoundException(`Stock item ${id} not found`);
    }
    return this.getById(id);
  }

  /**
   * Applies one increase or decrease to one stock item inside `manager`'s
   * transaction: read, apply the rule, versioned write, movement row.
   */
  private async change(
    manager: EntityManager,
    target: { productId: string; warehouseId: string; quantity: number },
    type: MovementType,
    actor: Actor,
    details: MovementDetails,
  ): Promise<StockChange> {
    const item = await manager.findOne(StockItem, {
      where: { productId: target.productId, warehouseId: target.warehouseId },
    });
    const adds = type === MovementType.In || type === MovementType.TransferIn;

    if (!item) {
      if (adds) throw new VersionConflictError(); // created concurrently: retry
      throw new StockRuleError(
        'INSUFFICIENT_STOCK',
        `Only 0 available, ${target.quantity} requested`,
        { available: 0, requested: target.quantity },
      );
    }

    const quantity = adds
      ? quantityAfterStockIn(item, target.quantity)
      : quantityAfterStockOut(item, target.quantity);

    const result = await manager
      .createQueryBuilder()
      .update(StockItem)
      .set({ quantity, version: () => 'version + 1' })
      .where('id = :id AND version = :version', {
        id: item.id,
        version: item.version,
      })
      .execute();
    if (result.affected !== 1) throw new VersionConflictError();

    const movement = await manager.save(
      manager.create(StockMovement, {
        stockItemId: item.id,
        productId: item.productId,
        warehouseId: item.warehouseId,
        type,
        quantity: target.quantity,
        quantityAfter: quantity,
        transferId: details.transferId ?? null,
        reference: details.reference ?? null,
        note: details.note ?? null,
        performedBy: actor.userId,
      }),
    );

    if (crossedLowStockThreshold(item, { ...item, quantity })) {
      await addToOutbox(
        manager,
        lowStockEvent({ ...item, quantity }, getCorrelationId()),
      );
    }

    const stock = await manager.findOneByOrFail(StockItem, { id: item.id });
    return { stock, movement };
  }

  /**
   * Makes sure a stock item row exists for the pair. The first time stock is
   * recorded for a product in a warehouse, both IDs are checked with the
   * services that own them. `ON CONFLICT DO NOTHING` makes two concurrent
   * first-time requests safe.
   */
  private async ensureStockItem(
    productId: string,
    warehouseId: string,
    actor: Actor,
  ): Promise<void> {
    const repository = this.dataSource.getRepository(StockItem);
    if (await repository.existsBy({ productId, warehouseId })) return;

    await Promise.all([
      this.catalog.assertProductUsable(productId, actor.authorization),
      this.catalog.assertWarehouseUsable(warehouseId, actor.authorization),
    ]);

    await repository
      .createQueryBuilder()
      .insert()
      .values({ productId, warehouseId })
      .orIgnore()
      .execute();
  }

  /** Runs `work` in a transaction, retrying if it loses a version race. */
  private async attempt<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await withOptimisticRetry(() => this.dataSource.transaction(work));
    } catch (error) {
      if (error instanceof VersionConflictError) {
        throw new ConflictException({
          error: 'STOCK_CONFLICT',
          message:
            'This stock item is being changed by other requests; please try again',
        });
      }
      if (error instanceof StockRuleError) {
        const body = {
          error: error.code,
          message: error.message,
          details: error.details,
        };
        throw error.code === 'INSUFFICIENT_STOCK'
          ? new ConflictException(body)
          : new BadRequestException(body);
      }
      throw error;
    }
  }
}
