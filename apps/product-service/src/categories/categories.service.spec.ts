import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { CategoriesService } from './categories.service';
import { Category } from './category.entity';

const dbError = (code: string) =>
  new QueryFailedError('SQL', [], { code } as never);

function setup(existing: Partial<Category>[] = []) {
  const rows = existing.map((row) => ({ ...row }) as Category);
  const repository = {
    findOne: jest.fn(
      async ({ where }: { where: { id: string } }) =>
        rows.find((row) => row.id === where.id) ?? null,
    ),
    create: (row: Category) => row,
    save: jest.fn(async (row: Category) => row),
    remove: jest.fn(async (row: Category) => row),
  };
  const service = new CategoriesService(
    repository as unknown as Repository<Category>,
  );
  return { service, repository };
}

describe('CategoriesService', () => {
  it('trims the name and defaults the description to null', async () => {
    const { service } = setup();

    const category = await service.create({ name: '  Power Tools ' });

    expect(category).toMatchObject({ name: 'Power Tools', description: null });
  });

  it('maps a duplicate name to CATEGORY_NAME_TAKEN', async () => {
    const { service, repository } = setup();
    repository.save.mockRejectedValueOnce(dbError('23505'));

    await expect(service.create({ name: 'Tools' })).rejects.toMatchObject({
      response: { error: 'CATEGORY_NAME_TAKEN' },
    });
  });

  it('updates only the fields that were sent', async () => {
    const { service } = setup([
      { id: 'c1', name: 'Tools', description: 'Old' },
    ]);

    const category = await service.update('c1', { name: 'Hand Tools' });

    expect(category).toMatchObject({ name: 'Hand Tools', description: 'Old' });
  });

  it('refuses to delete a category that still has products', async () => {
    const { service, repository } = setup([{ id: 'c1', name: 'Tools' }]);
    repository.remove.mockRejectedValueOnce(dbError('23503'));

    const attempt = service.remove('c1');

    await expect(attempt).rejects.toThrow(ConflictException);
    await expect(attempt).rejects.toMatchObject({
      response: { error: 'CATEGORY_IN_USE' },
    });
  });

  it('answers 404 for an unknown category', async () => {
    const { service } = setup();

    await expect(service.getById('missing')).rejects.toThrow(NotFoundException);
    await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
  });

  it('does not swallow unrelated database errors', async () => {
    const { service, repository } = setup();
    repository.save.mockRejectedValueOnce(new Error('connection lost'));

    await expect(service.create({ name: 'Tools' })).rejects.toThrow(
      'connection lost',
    );
  });
});
