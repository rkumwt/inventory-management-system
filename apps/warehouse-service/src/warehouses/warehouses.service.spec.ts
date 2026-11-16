import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { Warehouse } from './warehouse.entity';
import { normalizeCode, WarehousesService } from './warehouses.service';

function setup(existing: Partial<Warehouse>[] = []) {
  const rows = existing.map((row) => ({ ...row }) as Warehouse);
  const repository = {
    findOne: jest.fn(
      async ({ where }: { where: { id: string } }) =>
        rows.find((row) => row.id === where.id) ?? null,
    ),
    findAndCount: jest.fn(async (_options: unknown) => [rows, rows.length]),
    create: (row: Warehouse) => row,
    save: jest.fn(async (row: Warehouse) => row),
    update: jest.fn(
      async ({ id }: { id: string }, patch: Partial<Warehouse>) => {
        const row = rows.find((item) => item.id === id);
        if (row) Object.assign(row, patch);
        return { affected: row ? 1 : 0 };
      },
    ),
  };
  const service = new WarehousesService(
    repository as unknown as Repository<Warehouse>,
  );
  return { service, repository, rows };
}

const input = {
  code: ' wh-nyc ',
  name: ' New York DC ',
  city: 'New York',
  country: 'United States',
};

describe('WarehousesService', () => {
  it('normalises the code and fills defaults on create', async () => {
    const { service } = setup();

    const warehouse = await service.create(input);

    expect(warehouse).toMatchObject({
      code: 'WH-NYC',
      name: 'New York DC',
      address: null,
      isActive: true,
    });
  });

  it('maps a duplicate code to WAREHOUSE_CODE_TAKEN', async () => {
    const { service, repository } = setup();
    repository.save.mockRejectedValueOnce(
      new QueryFailedError('INSERT', [], { code: '23505' } as never),
    );

    const attempt = service.create(input);

    await expect(attempt).rejects.toThrow(ConflictException);
    await expect(attempt).rejects.toMatchObject({
      response: { error: 'WAREHOUSE_CODE_TAKEN' },
    });
  });

  it('keeps the isActive filter on every branch of a search', async () => {
    const { service, repository } = setup();

    await service.list({ page: 1, limit: 20, search: 'york', isActive: true });

    const { where } = repository.findAndCount.mock.calls[0]?.[0] as {
      where: Partial<Warehouse>[];
    };
    expect(where).toHaveLength(3);
    expect(where.every((branch) => branch.isActive === true)).toBe(true);
  });

  it('archives instead of deleting, and can be restored', async () => {
    const { service, rows } = setup([
      { id: 'w1', code: 'WH-1', isActive: true },
    ]);

    await service.archive('w1');
    expect(rows[0]?.isActive).toBe(false);

    const restored = await service.update('w1', { isActive: true });
    expect(restored.isActive).toBe(true);
  });

  it('answers 404 for an unknown warehouse', async () => {
    const { service } = setup();

    await expect(service.getById('missing')).rejects.toThrow(NotFoundException);
    await expect(service.archive('missing')).rejects.toThrow(NotFoundException);
  });

  it('normalizeCode trims and upper-cases', () => {
    expect(normalizeCode('  a-01-03 ')).toBe('A-01-03');
  });
});
