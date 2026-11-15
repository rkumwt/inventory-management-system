import { ProductAttributes, ProductUnit } from '../products/product.entity';

// IDs are fixed so that seed data in other services (stock levels, orders)
// can refer to the same products.
const category = (n: number) => `10000000-0000-4000-8000-00000000000${n}`;
const product = (n: number) =>
  `20000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;

export const SEED_CATEGORIES = [
  {
    id: category(1),
    name: 'Power Tools',
    description: 'Corded and cordless tools',
  },
  {
    id: category(2),
    name: 'Hand Tools',
    description: 'Hammers, wrenches, screwdrivers',
  },
  {
    id: category(3),
    name: 'Fasteners',
    description: 'Screws, bolts, nuts and anchors',
  },
  {
    id: category(4),
    name: 'Safety Gear',
    description: 'Personal protective equipment',
  },
];

interface SeedProduct {
  id: string;
  sku: string;
  name: string;
  price: number;
  unit: ProductUnit;
  categoryId: string;
  attributes: ProductAttributes;
}

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    id: product(1),
    sku: 'DRL-18V-001',
    name: 'Cordless Drill 18V',
    price: 129.99,
    unit: ProductUnit.Piece,
    categoryId: category(1),
    attributes: { voltage: 18, cordless: true, color: 'blue' },
  },
  {
    id: product(2),
    sku: 'SAW-CIR-185',
    name: 'Circular Saw 185mm',
    price: 159.5,
    unit: ProductUnit.Piece,
    categoryId: category(1),
    attributes: { bladeMm: 185, cordless: false, color: 'red' },
  },
  {
    id: product(3),
    sku: 'GRN-ANG-115',
    name: 'Angle Grinder 115mm',
    price: 74.9,
    unit: ProductUnit.Piece,
    categoryId: category(1),
    attributes: { discMm: 115, cordless: false, color: 'green' },
  },
  {
    id: product(4),
    sku: 'HMR-CLW-016',
    name: 'Claw Hammer 16oz',
    price: 18.75,
    unit: ProductUnit.Piece,
    categoryId: category(2),
    attributes: { weightOz: 16, handle: 'fiberglass' },
  },
  {
    id: product(5),
    sku: 'WRN-ADJ-250',
    name: 'Adjustable Wrench 250mm',
    price: 22.4,
    unit: ProductUnit.Piece,
    categoryId: category(2),
    attributes: { lengthMm: 250, material: 'chrome vanadium' },
  },
  {
    id: product(6),
    sku: 'SCR-SET-012',
    name: 'Screwdriver Set 12pc',
    price: 34,
    unit: ProductUnit.Pack,
    categoryId: category(2),
    attributes: { pieces: 12, magnetic: true },
  },
  {
    id: product(7),
    sku: 'SCW-WD-4X40',
    name: 'Wood Screws 4x40mm (200)',
    price: 9.95,
    unit: ProductUnit.Box,
    categoryId: category(3),
    attributes: { lengthMm: 40, count: 200, material: 'zinc' },
  },
  {
    id: product(8),
    sku: 'BLT-M8-050',
    name: 'Hex Bolts M8x50 (50)',
    price: 12.6,
    unit: ProductUnit.Box,
    categoryId: category(3),
    attributes: { thread: 'M8', lengthMm: 50, count: 50 },
  },
  {
    id: product(9),
    sku: 'GLV-NTR-L',
    name: 'Nitrile Work Gloves L',
    price: 6.5,
    unit: ProductUnit.Pack,
    categoryId: category(4),
    attributes: { size: 'L', color: 'blue' },
  },
  {
    id: product(10),
    sku: 'HLM-SFT-WHT',
    name: 'Safety Helmet White',
    price: 24.99,
    unit: ProductUnit.Piece,
    categoryId: category(4),
    attributes: { color: 'white', standard: 'EN 397' },
  },
];
