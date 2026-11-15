import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { WarehousesService } from '../warehouses/warehouses.service';
import { LocationsService } from './locations.service';
import { StorageLocation } from './storage-location.entity';

const WAREHOUSE_ID = 'w1';

function setup(existing: Partial<StorageLocation>[] = []) {
  const rows = existing.map((row) => ({ ...row }) as StorageLocation);
  const repository = {
    findOne: jest.fn(
      async ({ where }: { where: { id: string; warehouseId: string } }) =>
        rows.find(
          (row) => row.id === where.id && row.warehouseId === where.warehouseId,
        ) ?? null,
    ),
    create: (row: StorageLocation) => row,
    save: jest.fn(async (row: StorageLocation) => row),
    remove: jest.fn(async (row: StorageLocation) => row),
  };
  const warehouses = {
    getById: jest.fn(async (id: string) => {
      if (id !== WAREHOUSE_ID) throw new NotFoundException();
      return { id };
    }),
  };
  const service = new LocationsService(
    repository as unknown as Repository<StorageLocation>,
    warehouses as unknown as WarehousesService,
  );
  return { service, repository };
}

describe('LocationsService', () => {
  it('creates a location inside its warehouse with an upper-cased code', async () => {
    const { service } = setup();

    const location = await service.create(WAREHOUSE_ID, { code: 'a-01-03' });

    expect(location).toMatchObject({
      warehouseId: WAREHOUSE_ID,
      code: 'A-01-03',
      description: null,
    });
  });

  it('refuses to create a location in an unknown warehouse', async () => {
    const { service, repository } = setup();

    await expect(service.create('nope', { code: 'A-01' })).rejects.toThrow(
      NotFoundException,
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('maps a duplicate code in the same warehouse to LOCATION_CODE_TAKEN', async () => {
    const { service, repository } = setup();
    repository.save.mockRejectedValueOnce(
      new QueryFailedError('INSERT', [], { code: '23505' } as never),
    );

    const attempt = service.create(WAREHOUSE_ID, { code: 'A-01' });

    await expect(attempt).rejects.toThrow(ConflictException);
    await expect(attempt).rejects.toMatchObject({
      response: { error: 'LOCATION_CODE_TAKEN' },
    });
  });

  it("does not find a location through another warehouse's URL", async () => {
    const { service, repository } = setup([
      { id: 'l1', warehouseId: 'other-warehouse', code: 'A-01' },
    ]);

    await expect(service.getById(WAREHOUSE_ID, 'l1')).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.remove(WAREHOUSE_ID, 'l1')).rejects.toThrow(
      NotFoundException,
    );
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it('updates only the fields that were sent', async () => {
    const { service } = setup([
      { id: 'l1', warehouseId: WAREHOUSE_ID, code: 'A-01', description: 'Old' },
    ]);

    const location = await service.update(WAREHOUSE_ID, 'l1', { code: 'b-02' });

    expect(location).toMatchObject({ code: 'B-02', description: 'Old' });
  });
});
