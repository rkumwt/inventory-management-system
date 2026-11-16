import { addToOutbox, processOnce } from '@ims/database';
import { createEvent, EventEnvelope, EventName } from '@ims/events';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Order } from '../orders/order.entity';
import { transition } from '../orders/orders.service';
import { describeShortages, OrderTrigger } from './order-state';

/**
 * The event-driven half of the saga. order-service is the orchestrator: it
 * started the saga with OrderCreated, and here it decides what each reply
 * from inventory-service means for the order.
 *
 *   StockReserved          -> order CONFIRMED, publish OrderConfirmed
 *   StockReservationFailed -> order CANCELLED, publish OrderCancelled
 *
 * Each handler is one transaction: remember the event ID (idempotency),
 * move the order, write the follow-up event to the outbox.
 */
@Injectable()
export class OrderSagaService {
  private readonly logger = new Logger(OrderSagaService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async handleStockReserved(
    event: EventEnvelope<typeof EventName.StockReserved>,
  ): Promise<void> {
    await this.once(event, async (manager) => {
      const { orderId } = event.payload;
      const moved = await transition(
        manager,
        orderId,
        OrderTrigger.StockReserved,
      );
      if (!moved) {
        // Typically: the user cancelled while the reservation was in flight.
        // The OrderCancelled already published makes inventory release it.
        this.logger.warn(
          `Order ${orderId}: stock was reserved but the order is no longer pending; ignoring`,
        );
        return;
      }

      const order = await this.load(manager, orderId);
      await addToOutbox(
        manager,
        createEvent(
          EventName.OrderConfirmed,
          {
            orderId: order.id,
            orderNumber: order.orderNumber,
            totalAmount: order.totalAmount,
            createdBy: order.createdBy,
            createdByEmail: order.createdByEmail,
          },
          event.correlationId,
        ),
      );
      this.logger.log(`Order ${order.orderNumber} confirmed`);
    });
  }

  async handleStockReservationFailed(
    event: EventEnvelope<typeof EventName.StockReservationFailed>,
  ): Promise<void> {
    await this.once(event, async (manager) => {
      const { orderId, shortages } = event.payload;
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        relations: { items: true },
      });
      if (!order) {
        this.logger.warn(
          `Order ${orderId} not found; ignoring ${event.eventName}`,
        );
        return;
      }

      const skus = new Map(
        (order.items ?? []).map((item) => [item.productId, item.sku]),
      );
      const cancellationReason = describeShortages(shortages, skus);
      const moved = await transition(
        manager,
        orderId,
        OrderTrigger.StockReservationFailed,
        { cancellationReason },
      );
      if (!moved) return; // already cancelled by the user

      await addToOutbox(
        manager,
        createEvent(
          EventName.OrderCancelled,
          {
            orderId: order.id,
            orderNumber: order.orderNumber,
            warehouseId: order.warehouseId,
            reason: cancellationReason,
            createdBy: order.createdBy,
            createdByEmail: order.createdByEmail,
          },
          event.correlationId,
        ),
      );
      this.logger.log(`Order ${order.orderNumber} cancelled: no stock`);
    });
  }

  private async once(
    event: EventEnvelope,
    work: (manager: EntityManager) => Promise<void>,
  ): Promise<void> {
    const processed = await processOnce(this.dataSource, event, work);
    if (!processed) {
      this.logger.log(
        `Skipped duplicate ${event.eventName} ${event.eventId} (already processed)`,
      );
    }
  }

  private load(manager: EntityManager, id: string): Promise<Order> {
    return manager.findOneByOrFail(Order, { id });
  }
}
