import { EventEnvelope, EventName } from '@ims/events';
import { NotificationType } from './notification.entity';

/** The events this service turns into emails. */
export type NotifiableEvent =
  | EventEnvelope<typeof EventName.OrderConfirmed>
  | EventEnvelope<typeof EventName.OrderCancelled>
  | EventEnvelope<typeof EventName.LowStockDetected>;

export interface Email {
  type: NotificationType;
  recipient: string;
  subject: string;
  body: string;
}

const money = (amount: number) => amount.toFixed(2);

/**
 * Decides who gets told what. A pure function of the event, so the wording
 * and the recipients can be unit tested without a broker or a database.
 */
export function buildEmail(
  event: NotifiableEvent,
  settings: { lowStockAlertEmail: string },
): Email {
  switch (event.eventName) {
    case EventName.OrderConfirmed: {
      const { orderNumber, totalAmount, createdByEmail } = event.payload;
      return {
        type: NotificationType.OrderConfirmed,
        recipient: createdByEmail,
        subject: `Order ${orderNumber} confirmed`,
        body: `Stock has been reserved for order ${orderNumber}. Order total: ${money(totalAmount)}.`,
      };
    }
    case EventName.OrderCancelled: {
      const { orderNumber, reason, createdByEmail } = event.payload;
      return {
        type: NotificationType.OrderCancelled,
        recipient: createdByEmail,
        subject: `Order ${orderNumber} cancelled`,
        body: `Order ${orderNumber} was cancelled. Reason: ${reason}.`,
      };
    }
    case EventName.LowStockDetected: {
      const { productId, warehouseId, availableQuantity, threshold } =
        event.payload;
      return {
        type: NotificationType.LowStock,
        recipient: settings.lowStockAlertEmail,
        subject: `Low stock: product ${productId}`,
        body: `Product ${productId} in warehouse ${warehouseId} is down to ${availableQuantity} available (threshold ${threshold}).`,
      };
    }
  }
}
