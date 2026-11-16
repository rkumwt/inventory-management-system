/**
 * The stock rules, as pure functions: no database, no framework. StockService
 * loads a stock item, asks these functions what the new state should be, and
 * writes it back. Keeping the rules here makes them trivial to unit test.
 */

export interface StockLevels {
  quantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
}

/** A requested change that the rules do not allow. */
export class StockRuleError extends Error {
  constructor(
    readonly code: 'INVALID_QUANTITY' | 'INSUFFICIENT_STOCK',
    message: string,
    readonly details?: Record<string, number>,
  ) {
    super(message);
    this.name = 'StockRuleError';
  }
}

/** Units that can still be taken out or promised: on hand minus reserved. */
export function availableQuantity(
  levels: Pick<StockLevels, 'quantity' | 'reservedQuantity'>,
): number {
  return levels.quantity - levels.reservedQuantity;
}

export function isLowStock(levels: StockLevels): boolean {
  return availableQuantity(levels) <= levels.lowStockThreshold;
}

function assertWholePositive(amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new StockRuleError(
      'INVALID_QUANTITY',
      'Quantity must be a whole number greater than zero',
    );
  }
}

/** On-hand quantity after receiving `amount` units. */
export function quantityAfterStockIn(
  levels: StockLevels,
  amount: number,
): number {
  assertWholePositive(amount);
  return levels.quantity + amount;
}

/**
 * On-hand quantity after removing `amount` units. Reserved units are off
 * limits: only what is available can leave.
 */
export function quantityAfterStockOut(
  levels: StockLevels,
  amount: number,
): number {
  assertWholePositive(amount);
  const available = availableQuantity(levels);
  if (amount > available) {
    throw new StockRuleError(
      'INSUFFICIENT_STOCK',
      `Only ${available} available, ${amount} requested`,
      { available, requested: amount },
    );
  }
  return levels.quantity - amount;
}

/**
 * True when a change took the item from "enough" to "low". Used to report
 * the moment of crossing once, not on every later movement.
 */
export function crossedLowStockThreshold(
  before: StockLevels,
  quantityAfter: number,
): boolean {
  return (
    !isLowStock(before) && isLowStock({ ...before, quantity: quantityAfter })
  );
}
