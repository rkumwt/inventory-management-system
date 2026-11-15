import { EventName } from './event-names';

export interface OrderLineItem {
  productId: string;
  sku: string;
  quantity: number;
  unitPrice: number;
}

export interface StockLineItem {
  productId: string;
  quantity: number;
}

/** Saga step 1: order-service asks for stock to be reserved. */
export interface OrderCreatedPayload {
  orderId: string;
  orderNumber: string;
  warehouseId: string;
  items: OrderLineItem[];
  totalAmount: number;
  createdBy: string;
}

/** Saga step 2 (success): inventory-service reserved every line. */
export interface StockReservedPayload {
  orderId: string;
  warehouseId: string;
  items: StockLineItem[];
}

/** Saga step 2 (failure): nothing was reserved; the order must be cancelled. */
export interface StockReservationFailedPayload {
  orderId: string;
  warehouseId: string;
  reason: string;
  shortages: Array<{
    productId: string;
    requested: number;
    available: number;
  }>;
}

/** Compensation: a previous reservation was returned to available stock. */
export interface StockReleasedPayload {
  orderId: string;
  warehouseId: string;
  items: StockLineItem[];
}

export interface OrderConfirmedPayload {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  createdBy: string;
}

export interface OrderCancelledPayload {
  orderId: string;
  orderNumber: string;
  warehouseId: string;
  reason: string;
  createdBy: string;
}

export interface LowStockDetectedPayload {
  productId: string;
  warehouseId: string;
  availableQuantity: number;
  threshold: number;
}

/** Single source of truth linking each event name to its payload type. */
export interface EventPayloadMap {
  [EventName.OrderCreated]: OrderCreatedPayload;
  [EventName.OrderConfirmed]: OrderConfirmedPayload;
  [EventName.OrderCancelled]: OrderCancelledPayload;
  [EventName.StockReserved]: StockReservedPayload;
  [EventName.StockReservationFailed]: StockReservationFailedPayload;
  [EventName.StockReleased]: StockReleasedPayload;
  [EventName.LowStockDetected]: LowStockDetectedPayload;
}
