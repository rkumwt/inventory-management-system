import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { Product, ProductUnit } from './product.entity';
import { normalizeSku, ProductsService } from './products.service';

const CATEGORY_ID = 'category-1';

function setup(existing: Partial<Product>[] = []) {
  const rows = existing.map((row) => ({ ...row }) as Product);
  const repository = {
    findOne: jest.fn(
      async ({ where }: { where: { id: string } }) =>
        rows.find((row) => row.id === where.id) ?? null,
    ),
    create: (row: Product) => row,
    save: jest.fn(async (row: Product) => {
      const saved = { ...row, id: row.id ?? 'new-id' } as Product;
      const index = rows.findIndex((item) => item.id === saved.id);
      if (index >= 0) rows[index] = saved;
      else rows.push(saved);
      return saved;
    }),
    update: jest.fn(async ({ id }: { id: string }, patch: Partial<Product>) => {
      const row = rows.find((item) => item.id === id);
      if (row) Object.assign(row, patch);
      return { affected: row ? 1 : 0 };
    }),
  };
  const categories = {
    findById: jest.fn(async (id: string) =>
      id === CATEGORY_ID ? { id, name: 'Power Tools' } : null,
    ),
  };
  const service = new ProductsService(
    repository as unknown as Repository<Product>,
    categories as unknown as CategoriesService,
  );
  return { service, repository, categories, rows };
}

const input = {
  sku: ' drl-18v-001 ',
  name: ' Cordless Drill 18V ',
  price: 129.99,
  unit: ProductUnit.Piece,
};

describe('ProductsService', () => {
  it('normalises the SKU and fills defaults on create', async () => {
    const { service } = setup();

    const product = await service.create(input);

    expect(product).toMatchObject({
      sku: 'DRL-18V-001',
      name: 'Cordless Drill 18V',
      description: null,
      attributes: {},
      categoryId: null,
      isActive: true,
    });
  });

  it('rejects a category that does not exist, before writing', async () => {
    const { service, repository } = setup();

    const attempt = service.create({ ...input, categoryId: 'nope' });

    await expect(attempt).rejects.toThrow(BadRequestException);
    await expect(attempt).rejects.toMatchObject({
      response: { error: 'CATEGORY_NOT_FOUND' },
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('maps a duplicate SKU to SKU_ALREADY_EXISTS', async () => {
    const { service, repository } = setup();
    repository.save.mockRejectedValueOnce(
      new QueryFailedError('INSERT', [], { code: '23505' } as never),
    );

    const attempt = service.create(input);

    await expect(attempt).rejects.toThrow(ConflictException);
    await expect(attempt).rejects.toMatchObject({
      response: { error: 'SKU_ALREADY_EXISTS' },
    });
  });

  it('updates only the fields that were sent', async () => {
    const { service } = setup([
      { id: 'p1', sku: 'A-1', name: 'Old', price: 5, categoryId: CATEGORY_ID },
    ]);

    const product = await service.update('p1', { price: 7.5 });

    expect(product).toMatchObject({
      sku: 'A-1',
      name: 'Old',
      price: 7.5,
      categoryId: CATEGORY_ID,
    });
  });

  it('clears the category when categoryId is null', async () => {
    const { service, categories } = setup([
      { id: 'p1', sku: 'A-1', categoryId: CATEGORY_ID },
    ]);

    const product = await service.update('p1', { categoryId: null });

    expect(product.categoryId).toBeNull();
    expect(categories.findById).not.toHaveBeenCalled();
  });

  it('archives instead of deleting, and can be restored', async () => {
    const { service, rows } = setup([{ id: 'p1', sku: 'A-1', isActive: true }]);

    await service.archive('p1');
    expect(rows[0]?.isActive).toBe(false);

    const restored = await service.update('p1', { isActive: true });
    expect(restored.isActive).toBe(true);
  });

  it('answers 404 for an unknown product', async () => {
    const { service } = setup();

    await expect(service.getById('missing')).rejects.toThrow(NotFoundException);
    await expect(service.update('missing', {})).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.archive('missing')).rejects.toThrow(NotFoundException);
  });

  it('normalizeSku trims and upper-cases', () => {
    expect(normalizeSku('  ab-12 ')).toBe('AB-12');
  });
});
