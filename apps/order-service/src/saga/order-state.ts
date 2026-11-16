/**
 * The order state machine, as pure data and functions. This is the heart of
 * the saga: given where an order is and what just happened, what is it now?
 *
 *   PENDING ──StockReserved──────────▶ CONFIRMED
 *   PENDING ──StockReservationFailed─▶ CANCELLED
 *   PENDING ──CancelRequested────────▶ CANCELLED
 *   CONFIRMED ──CancelRequested──────▶ CANCELLED
 *
 * Anything else is not a transition. Events are delivered at least once and
 * can arrive late, so "not a transition" must be a calm no-op, never a crash:
 * e.g. StockReserved for an order the user has already cancelled.
 */

export enum OrderStatus {
  /** Placed; waiting for inventory-service to reserve stock. */
  Pending = 'PENDING',
  /** Stock is reserved for it. */
  Confirmed = 'CONFIRMED',
  /** Out of stock or cancelled by a user. Final. */
  Cancelled = 'CANCELLED',
}

export enum OrderTrigger {
  StockReserved = 'STOCK_RESERVED',
  StockReservationFailed = 'STOCK_RESERVATION_FAILED',
  CancelRequested = 'CANCEL_REQUESTED',
}

const TRANSITIONS: Readonly<
  Record<OrderStatus, Partial<Record<OrderTrigger, OrderStatus>>>
> = {
  [OrderStatus.Pending]: {
    [OrderTrigger.StockReserved]: OrderStatus.Confirmed,
    [OrderTrigger.StockReservationFailed]: OrderStatus.Cancelled,
    [OrderTrigger.CancelRequested]: OrderStatus.Cancelled,
  },
  [OrderStatus.Confirmed]: {
    [OrderTrigger.CancelRequested]: OrderStatus.Cancelled,
  },
  [OrderStatus.Cancelled]: {},
};

/** The status after `trigger`, or undefined if it does not apply. */
export function nextStatus(
  current: OrderStatus,
  trigger: OrderTrigger,
): OrderStatus | undefined {
  return TRANSITIONS[current][trigger];
}

/** Statuses from which `trigger` leads somewhere. */
export function statusesAccepting(trigger: OrderTrigger): OrderStatus[] {
  return Object.values(OrderStatus).filter(
    (status) => nextStatus(status, trigger) !== undefined,
  );
}

export interface PricedLine {
  quantity: number;
  unitPrice: number;
}

/** Money is added up in whole cents to avoid floating-point drift. */
const toCents = (amount: number) => Math.round(amount * 100);

export function lineTotal(line: PricedLine): number {
  return (line.quantity * toCents(line.unitPrice)) / 100;
}

export function orderTotal(lines: PricedLine[]): number {
  return (
    lines.reduce(
      (cents, line) => cents + line.quantity * toCents(line.unitPrice),
      0,
    ) / 100
  );
}

/** Human-readable reason stored on an order cancelled for lack of stock. */
export function describeShortages(
  shortages: Array<{ productId: string; requested: number; available: number }>,
  skuByProduct: ReadonlyMap<string, string>,
): string {
  const parts = shortages.map(
    (shortage) =>
      `${skuByProduct.get(shortage.productId) ?? shortage.productId}: requested ${shortage.requested}, available ${shortage.available}`,
  );
  return `Insufficient stock (${parts.join('; ')})`;
}
