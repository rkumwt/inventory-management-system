import { addToOutbox, processOnce } from '@ims/database';
import { createEvent, EventEnvelope, EventName } from '@ims/events';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  VersionConflictError,
  withOptimisticRetry,
} from '../stock/optimistic-retry';
import { StockItem } from '../stock/stock-item.entity';
import {
  crossedLowStockThreshold,
  findShortages,
  mergeLines,
  reservedAfterRelease,
  reservedAfterReserve,
  StockLine,
} from '../stock/stock-rules';
import { lowStockEvent } from '../stock/stock.service';
import {
  ReservationStatus,
  StockReservation,
} from './stock-reservation.entity';

/**
 * inventory-service's part in the order saga.
 *
 * - OrderCreated   -> reserve every line, or none. Answer with StockReserved
 *                     or StockReservationFailed.
 * - OrderCancelled -> give the reservation back (the compensating action).
 *                     Answer with StockReleased.
 *
 * Each handler does everything in ONE database transaction: record the event
 * ID (idempotency), change stock, save the reservation, and write the reply
 * to the outbox. So a crash at any point leaves either all of it or none of
 * it, and a redelivered event is recognised and skipped.
 */
@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async handleOrderCreated(
    event: EventEnvelope<typeof EventName.OrderCreated>,
  ): Promise<void> {
    const processed = await withOptimisticRetry(() =>
      processOnce(this.dataSource, event, (manager) =>
        this.reserve(manager, event),
      ),
    );
    if (!processed) this.logDuplicate(event);
  }

  async handleOrderCancelled(
    event: EventEnvelope<typeof EventName.OrderCancelled>,
  ): Promise<void> {
    const processed = await withOptimisticRetry(() =>
      processOnce(this.dataSource, event, (manager) =>
        this.release(manager, event),
      ),
    );
    if (!processed) this.logDuplicate(event);
  }

  private async reserve(
    manager: EntityManager,
    event: EventEnvelope<typeof EventName.OrderCreated>,
  ): Promise<void> {
    const { orderId, warehouseId } = event.payload;

    // A row already exists if the cancellation overtook the creation.
    if (await manager.existsBy(StockReservation, { orderId })) return;

    const lines = mergeLines(event.payload.items);
    const stock = await manager.find(StockItem, {
      where: {
        warehouseId,
        productId: In(lines.map((line) => line.productId)),
      },
    });
    const byProduct = new Map(stock.map((item) => [item.productId, item]));

    const shortages = findShortages(lines, byProduct);
    if (shortages.length > 0) {
      await manager.insert(StockReservation, {
        orderId,
        warehouseId,
        status: ReservationStatus.Rejected,
        items: [],
      });
      await addToOutbox(
        manager,
        createEvent(
          EventName.StockReservationFailed,
          { orderId, warehouseId, reason: 'INSUFFICIENT_STOCK', shortages },
          event.correlationId,
        ),
      );
      this.logger.warn(`Order ${orderId}: not enough stock, nothing reserved`);
      return;
    }

    for (const line of lines) {
      const item = byProduct.get(line.productId) as StockItem;
      const reservedQuantity = reservedAfterReserve(item, line.quantity);
      await this.writeReserved(manager, item, reservedQuantity);

      const after = { ...item, reservedQuantity };
      if (crossedLowStockThreshold(item, after)) {
        await addToOutbox(manager, lowStockEvent(after, event.correlationId));
      }
    }

    await manager.insert(StockReservation, {
      orderId,
      warehouseId,
      status: ReservationStatus.Reserved,
      items: lines,
    });
    await addToOutbox(
      manager,
      createEvent(
        EventName.StockReserved,
        { orderId, warehouseId, items: lines },
        event.correlationId,
      ),
    );
    this.logger.log(`Order ${orderId}: stock reserved`);
  }

  private async release(
    manager: EntityManager,
    event: EventEnvelope<typeof EventName.OrderCancelled>,
  ): Promise<void> {
    const { orderId, warehouseId } = event.payload;
    const reservation = await manager.findOne(StockReservation, {
      where: { orderId },
    });

    if (!reservation) {
      // Cancelled before we saw the order. Leave a marker so that a late
      // OrderCreated does not reserve stock for an order that is already dead.
      await manager.insert(StockReservation, {
        orderId,
        warehouseId,
        status: ReservationStatus.Released,
        items: [],
      });
      return;
    }
    if (reservation.status !== ReservationStatus.Reserved) return;

    const stock = await manager.find(StockItem, {
      where: {
        warehouseId: reservation.warehouseId,
        productId: In(reservation.items.map((line) => line.productId)),
      },
    });
    const byProduct = new Map(stock.map((item) => [item.productId, item]));

    for (const line of reservation.items) {
      const item = byProduct.get(line.productId);
      if (!item) continue;
      await this.writeReserved(
        manager,
        item,
        reservedAfterRelease(item, line.quantity),
      );
    }

    await manager.update(StockReservation, reservation.id, {
      status: ReservationStatus.Released,
    });
    await addToOutbox(
      manager,
      createEvent(
        EventName.StockReleased,
        {
          orderId,
          warehouseId: reservation.warehouseId,
          items: reservation.items as StockLine[],
        },
        event.correlationId,
      ),
    );
    this.logger.log(`Order ${orderId}: reservation released`);
  }

  /** Versioned write, same optimistic lock as every other stock change. */
  private async writeReserved(
    manager: EntityManager,
    item: StockItem,
    reservedQuantity: number,
  ): Promise<void> {
    const result = await manager
      .createQueryBuilder()
      .update(StockItem)
      .set({ reservedQuantity, version: () => 'version + 1' })
      .where('id = :id AND version = :version', {
        id: item.id,
        version: item.version,
      })
      .execute();
    if (result.affected !== 1) throw new VersionConflictError();
  }

  private logDuplicate(event: EventEnvelope): void {
    this.logger.log(
      `Skipped duplicate ${event.eventName} ${event.eventId} (already processed)`,
    );
  }
}
