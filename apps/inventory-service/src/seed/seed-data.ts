// The same fixed IDs that product-service and warehouse-service seed.
const product = (n: number) =>
  `20000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const warehouse = (n: number) => `30000000-0000-4000-8000-00000000000${n}`;

interface SeedStock {
  productId: string;
  warehouseId: string;
  quantity: number;
  lowStockThreshold: number;
}

/** [quantity in WH-NYC, WH-LON, WH-BLR, threshold] per seed product 1..10. */
const LEVELS: [number, number, number, number][] = [
  [42, 18, 30, 10], // Cordless Drill
  [15, 6, 0, 5], // Circular Saw
  [8, 25, 12, 10], // Angle Grinder (low in NYC)
  [120, 80, 95, 20], // Claw Hammer
  [60, 3, 44, 10], // Adjustable Wrench (low in LON)
  [35, 28, 0, 8], // Screwdriver Set
  [400, 250, 310, 50], // Wood Screws
  [180, 20, 140, 25], // Hex Bolts (low in LON)
  [75, 90, 4, 15], // Nitrile Gloves (low in BLR)
  [22, 14, 31, 10], // Safety Helmet
];

/** Pairs with a quantity of 0 are skipped: no stock was ever recorded. */
export const SEED_STOCK: SeedStock[] = LEVELS.flatMap(
  ([nyc, lon, blr, lowStockThreshold], index) =>
    [nyc, lon, blr]
      .map((quantity, site) => ({
        productId: product(index + 1),
        warehouseId: warehouse(site + 1),
        quantity,
        lowStockThreshold,
      }))
      .filter((row) => row.quantity > 0),
);
