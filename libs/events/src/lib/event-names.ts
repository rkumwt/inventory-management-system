/**
 * Every integration event in the system. The string value is the routing key
 * on the RabbitMQ topic exchange and the pattern consumers subscribe to.
 */
export const EventName = {
  OrderCreated: 'order.created',
  OrderConfirmed: 'order.confirmed',
  OrderCancelled: 'order.cancelled',
  StockReserved: 'stock.reserved',
  StockReservationFailed: 'stock.reservation_failed',
  StockReleased: 'stock.released',
  LowStockDetected: 'stock.low_detected',
} as const;

export type EventName = (typeof EventName)[keyof typeof EventName];

/** Topic exchange all integration events are published to. */
export const EVENTS_EXCHANGE = 'ims.events';

/** One durable queue per consuming service (competing consumers per service). */
export const EventQueue = {
  Inventory: 'ims.inventory.events',
  Order: 'ims.order.events',
  Notification: 'ims.notification.events',
} as const;

export type EventQueue = (typeof EventQueue)[keyof typeof EventQueue];
