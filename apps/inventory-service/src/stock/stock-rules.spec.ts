import {
  availableQuantity,
  crossedLowStockThreshold,
  isLowStock,
  quantityAfterStockIn,
  quantityAfterStockOut,
  StockLevels,
  StockRuleError,
} from './stock-rules';

const levels = (overrides: Partial<StockLevels> = {}): StockLevels => ({
  quantity: 20,
  reservedQuantity: 0,
  lowStockThreshold: 5,
  ...overrides,
});

describe('stock rules', () => {
  describe('availableQuantity', () => {
    it('is on-hand minus reserved', () => {
      expect(availableQuantity(levels({ reservedQuantity: 8 }))).toBe(12);
    });
  });

  describe('stock in', () => {
    it('adds to the on-hand quantity', () => {
      expect(quantityAfterStockIn(levels(), 5)).toBe(25);
    });

    it.each([0, -3, 1.5, Number.NaN])('rejects a quantity of %p', (amount) => {
      expect(() => quantityAfterStockIn(levels(), amount)).toThrow(
        StockRuleError,
      );
    });
  });

  describe('stock out', () => {
    it('subtracts from the on-hand quantity', () => {
      expect(quantityAfterStockOut(levels(), 5)).toBe(15);
    });

    it('allows taking exactly everything that is available', () => {
      expect(quantityAfterStockOut(levels(), 20)).toBe(0);
    });

    it('never lets stock go negative', () => {
      expect(() => quantityAfterStockOut(levels(), 21)).toThrow(
        expect.objectContaining({
          code: 'INSUFFICIENT_STOCK',
          details: { available: 20, requested: 21 },
        }),
      );
    });

    it('does not let reserved units leave', () => {
      const reserved = levels({ reservedQuantity: 15 });

      expect(quantityAfterStockOut(reserved, 5)).toBe(15);
      expect(() => quantityAfterStockOut(reserved, 6)).toThrow(
        expect.objectContaining({
          code: 'INSUFFICIENT_STOCK',
          details: { available: 5, requested: 6 },
        }),
      );
    });

    it.each([0, -1, 2.5])('rejects a quantity of %p', (amount) => {
      expect(() => quantityAfterStockOut(levels(), amount)).toThrow(
        expect.objectContaining({ code: 'INVALID_QUANTITY' }),
      );
    });
  });

  describe('low stock', () => {
    it('is low at or below the threshold, counting only available units', () => {
      expect(isLowStock(levels({ quantity: 6 }))).toBe(false);
      expect(isLowStock(levels({ quantity: 5 }))).toBe(true);
      expect(isLowStock(levels({ quantity: 12, reservedQuantity: 8 }))).toBe(
        true,
      );
    });

    it('reports the crossing only when a change takes the item below the line', () => {
      expect(crossedLowStockThreshold(levels({ quantity: 8 }), 5)).toBe(true);
      // Still above the threshold.
      expect(crossedLowStockThreshold(levels({ quantity: 8 }), 6)).toBe(false);
      // Was already low: not a new crossing.
      expect(crossedLowStockThreshold(levels({ quantity: 4 }), 2)).toBe(false);
      // Restocking never counts.
      expect(crossedLowStockThreshold(levels({ quantity: 4 }), 50)).toBe(false);
    });
  });
});
