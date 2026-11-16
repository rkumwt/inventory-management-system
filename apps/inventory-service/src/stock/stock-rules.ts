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
  after: StockLevels,
): boolean {
  return !isLowStock(before) && isLowStock(after);
}

export interface StockLine {
  productId: string;
  quantity: number;
}

export interface Shortage {
  productId: string;
  requested: number;
  available: number;
}

/** Adds up lines for the same product, so each product is checked once. */
export function mergeLines(lines: StockLine[]): StockLine[] {
  const totals = new Map<string, number>();
  for (const line of lines) {
    totals.set(
      line.productId,
      (totals.get(line.productId) ?? 0) + line.quantity,
    );
  }
  return [...totals].map(([productId, quantity]) => ({ productId, quantity }));
}

/**
 * Which lines of an order cannot be reserved in full. An order is reserved
 * all-or-nothing, so any shortage means nothing is reserved. A product with
 * no stock record in the warehouse has zero available.
 */
export function findShortages(
  lines: StockLine[],
  levelsByProduct: ReadonlyMap<
    string,
    Pick<StockLevels, 'quantity' | 'reservedQuantity'>
  >,
): Shortage[] {
  return mergeLines(lines).flatMap((line) => {
    const levels = levelsByProduct.get(line.productId);
    const available = levels ? availableQuantity(levels) : 0;
    return line.quantity > available
      ? [{ productId: line.productId, requested: line.quantity, available }]
      : [];
  });
}

/** Reserved quantity after promising `amount` more units to an order. */
export function reservedAfterReserve(
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
  return levels.reservedQuantity + amount;
}

/** Reserved quantity after giving `amount` units back. Never below zero. */
export function reservedAfterRelease(
  levels: StockLevels,
  amount: number,
): number {
  assertWholePositive(amount);
  return Math.max(0, levels.reservedQuantity - amount);
}
