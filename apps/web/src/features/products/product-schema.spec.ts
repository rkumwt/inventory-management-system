import { estimateTotal, orderFormSchema } from '@/features/orders/order-schema';
import {
  formatAttributes,
  parseAttributes,
  productFormSchema,
  toProductInput,
} from './product-schema';

const valid = {
  sku: 'DRL-18V-001',
  name: 'Cordless Drill',
  description: '',
  price: '129.99',
  unit: 'pcs',
  categoryId: '',
  attributes: 'voltage: 18\ncolor: blue\ncordless: true',
};

describe('product form', () => {
  it('reads "key: value" lines, keeping numbers and booleans typed', () => {
    expect(parseAttributes(valid.attributes)).toEqual({
      voltage: 18,
      color: 'blue',
      cordless: true,
    });
    expect(parseAttributes('standard: EN 397: 2012')).toEqual({
      standard: 'EN 397: 2012',
    });
    expect(parseAttributes('\n  \n')).toEqual({});
  });

  it('round-trips attributes through the text form', () => {
    const attributes = { voltage: 18, color: 'blue', cordless: true };

    expect(parseAttributes(formatAttributes(attributes))).toEqual(attributes);
  });

  it.each(['color', 'color:', ': blue'])('rejects the line %p', (line) => {
    expect(() => parseAttributes(line)).toThrow();
  });

  it('converts form strings into the API input', () => {
    const values = productFormSchema.parse(valid);

    expect(toProductInput(values)).toEqual({
      sku: 'DRL-18V-001',
      name: 'Cordless Drill',
      description: null,
      price: 129.99,
      unit: 'pcs',
      categoryId: null,
      attributes: { voltage: 18, color: 'blue', cordless: true },
    });
  });

  it.each([
    ['a SKU with spaces', { sku: 'DRL 18V' }],
    ['an empty name', { name: ' ' }],
    ['three decimals in the price', { price: '1.999' }],
    ['a negative price', { price: '-1' }],
    ['malformed attributes', { attributes: 'just text' }],
  ])('rejects %s', (_label, override) => {
    expect(productFormSchema.safeParse({ ...valid, ...override }).success).toBe(
      false,
    );
  });
});

describe('order form', () => {
  const order = {
    warehouseId: 'w1',
    note: '',
    items: [{ productId: 'p1', quantity: '2' }],
  };

  it('accepts a valid order', () => {
    expect(orderFormSchema.safeParse(order).success).toBe(true);
  });

  it.each([
    ['no warehouse', { warehouseId: '' }],
    ['no items', { items: [] }],
    ['a zero quantity', { items: [{ productId: 'p1', quantity: '0' }] }],
    [
      'the same product twice',
      {
        items: [
          { productId: 'p1', quantity: '1' },
          { productId: 'p1', quantity: '2' },
        ],
      },
    ],
  ])('rejects %s', (_label, override) => {
    expect(orderFormSchema.safeParse({ ...order, ...override }).success).toBe(
      false,
    );
  });

  it('estimates the total in cents, ignoring unfinished lines', () => {
    const prices = new Map([
      ['p1', 0.1],
      ['p2', 24.99],
    ]);
    const total = estimateTotal(
      [
        { productId: 'p1', quantity: '3' },
        { productId: 'p2', quantity: '2' },
        { productId: '', quantity: '5' },
        { productId: 'p2', quantity: '' },
      ],
      (id) => prices.get(id),
    );

    expect(total).toBe(50.28);
  });
});
