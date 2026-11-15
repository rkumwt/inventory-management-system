// IDs are fixed so that seed data in other services (stock levels, orders)
// can refer to the same warehouses.
const warehouse = (n: number) => `30000000-0000-4000-8000-00000000000${n}`;
const location = (n: number) =>
  `40000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;

export const SEED_WAREHOUSES = [
  {
    id: warehouse(1),
    code: 'WH-NYC',
    name: 'New York Distribution Center',
    address: '500 Harbor Blvd',
    city: 'New York',
    country: 'United States',
  },
  {
    id: warehouse(2),
    code: 'WH-LON',
    name: 'London Fulfilment Hub',
    address: '12 Dockside Road',
    city: 'London',
    country: 'United Kingdom',
  },
  {
    id: warehouse(3),
    code: 'WH-BLR',
    name: 'Bengaluru Regional Warehouse',
    address: '8 Whitefield Main Road',
    city: 'Bengaluru',
    country: 'India',
  },
];

const AISLES = [
  ['A-01-01', 'Aisle A, rack 1, shelf 1'],
  ['A-01-02', 'Aisle A, rack 1, shelf 2'],
  ['B-01-01', 'Aisle B, rack 1, shelf 1'],
  ['DOCK-01', 'Receiving dock'],
] as const;

/** The same four locations in each warehouse. */
export const SEED_LOCATIONS = SEED_WAREHOUSES.flatMap((seed, index) =>
  AISLES.map(([code, description], offset) => ({
    id: location(index * AISLES.length + offset + 1),
    warehouseId: seed.id,
    code,
    description,
  })),
);
