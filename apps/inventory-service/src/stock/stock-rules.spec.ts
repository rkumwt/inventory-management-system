import {
  availableQuantity,
  crossedLowStockThreshold,
  findShortages,
  isLowStock,
  quantityAfterStockIn,
  quantityAfterStockOut,
  reservedAfterRelease,
  reservedAfterReserve,
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
      const crossed = (before: number, after: number) =>
        crossedLowStockThreshold(
          levels({ quantity: before }),
          levels({ quantity: after }),
        );

      expect(crossed(8, 5)).toBe(true);
      // Still above the threshold.
      expect(crossed(8, 6)).toBe(false);
      // Was already low: not a new crossing.
      expect(crossed(4, 2)).toBe(false);
      // Restocking never counts.
      expect(crossed(4, 50)).toBe(false);
    });

    it('also counts a reservation that eats into available stock', () => {
      expect(
        crossedLowStockThreshold(
          levels({ quantity: 20 }),
          levels({ quantity: 20, reservedQuantity: 16 }),
        ),
      ).toBe(true);
    });
  });

  describe('reservations', () => {
    it('reserves available units and releases them again', () => {
      const reserved = reservedAfterReserve(levels(), 8);
      expect(reserved).toBe(8);
      expect(
        reservedAfterRelease(levels({ reservedQuantity: reserved }), 8),
      ).toBe(0);
    });

    it('cannot reserve more than is available', () => {
      expect(() =>
        reservedAfterReserve(levels({ reservedQuantity: 15 }), 6),
      ).toThrow(expect.objectContaining({ code: 'INSUFFICIENT_STOCK' }));
    });

    it('never releases below zero', () => {
      expect(reservedAfterRelease(levels({ reservedQuantity: 2 }), 5)).toBe(0);
    });

    it('lists every line that cannot be reserved in full', () => {
      const stock = new Map([
        ['drill', { quantity: 10, reservedQuantity: 4 }],
        ['saw', { quantity: 3, reservedQuantity: 0 }],
      ]);

      expect(
        findShortages(
          [
            { productId: 'drill', quantity: 6 },
            { productId: 'saw', quantity: 5 },
            { productId: 'unknown', quantity: 1 },
          ],
          stock,
        ),
      ).toEqual([
        { productId: 'saw', requested: 5, available: 3 },
        { productId: 'unknown', requested: 1, available: 0 },
      ]);
    });

    it('adds up repeated lines for the same product before checking', () => {
      const stock = new Map([['drill', { quantity: 10, reservedQuantity: 0 }]]);
      const lines = [
        { productId: 'drill', quantity: 6 },
        { productId: 'drill', quantity: 6 },
      ];

      expect(findShortages(lines, stock)).toEqual([
        { productId: 'drill', requested: 12, available: 10 },
      ]);
    });
  });
});
