import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ProductUnit } from '../product.entity';
import {
  CreateProductDto,
  isProductAttributes,
  ProductQueryDto,
  ProductSortField,
} from './product.dto';

const errorsFor = <T extends object>(type: new () => T, input: object) =>
  validateSync(plainToInstance(type, input)).map((error) => error.property);

const valid = {
  sku: 'DRL-18V-001',
  name: 'Cordless Drill',
  price: 129.99,
  unit: ProductUnit.Piece,
};

describe('CreateProductDto', () => {
  it('accepts a minimal valid product', () => {
    expect(errorsFor(CreateProductDto, valid)).toEqual([]);
  });

  it.each([
    ['a SKU with spaces', { sku: 'DRL 18V' }, 'sku'],
    ['a negative price', { price: -1 }, 'price'],
    ['a price with three decimals', { price: 1.999 }, 'price'],
    ['an unknown unit', { unit: 'dozen' }, 'unit'],
    ['nested attributes', { attributes: { size: { w: 1 } } }, 'attributes'],
    ['an attribute array', { attributes: ['red'] }, 'attributes'],
    ['a malformed category id', { categoryId: 'abc' }, 'categoryId'],
  ])('rejects %s', (_label, override, property) => {
    expect(errorsFor(CreateProductDto, { ...valid, ...override })).toEqual([
      property,
    ]);
  });
});

describe('ProductQueryDto', () => {
  it('applies defaults', () => {
    const query = plainToInstance(ProductQueryDto, {});

    expect(query).toMatchObject({
      page: 1,
      limit: 20,
      sortBy: ProductSortField.Name,
      sortOrder: 'asc',
    });
  });

  it('converts query-string values to their real types', () => {
    const query = plainToInstance(ProductQueryDto, {
      minPrice: '10',
      maxPrice: '99.5',
      isActive: 'false',
      attributes: '{"color":"blue","voltage":18}',
    });

    expect(validateSync(query)).toEqual([]);
    expect(query).toMatchObject({
      minPrice: 10,
      maxPrice: 99.5,
      isActive: false,
      attributes: { color: 'blue', voltage: 18 },
    });
  });

  it.each([
    [
      'attributes that are not JSON',
      { attributes: 'color=blue' },
      'attributes',
    ],
    ['a sort field that is not allowed', { sortBy: 'password' }, 'sortBy'],
    ['a sort order that is not asc or desc', { sortOrder: 'up' }, 'sortOrder'],
    ['a non-numeric price', { minPrice: 'cheap' }, 'minPrice'],
  ])('rejects %s', (_label, input, property) => {
    expect(errorsFor(ProductQueryDto, input)).toEqual([property]);
  });
});

describe('isProductAttributes', () => {
  it('allows only flat string, number and boolean values', () => {
    expect(isProductAttributes({ a: 'x', b: 1, c: true })).toBe(true);
    expect(isProductAttributes({ a: null })).toBe(false);
    expect(isProductAttributes(null)).toBe(false);
    expect(isProductAttributes('{}')).toBe(false);
  });
});
