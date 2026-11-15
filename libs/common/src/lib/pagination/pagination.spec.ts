import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { paginate, PaginationQueryDto, toSkip } from './pagination';

const parse = (query: Record<string, string>) =>
  plainToInstance(PaginationQueryDto, query);

describe('PaginationQueryDto', () => {
  it('defaults to page 1 with 20 items', () => {
    const dto = parse({});

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto).toMatchObject({ page: 1, limit: 20 });
  });

  it('coerces query-string numbers', () => {
    const dto = parse({ page: '3', limit: '50', search: 'bolt' });

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto).toMatchObject({ page: 3, limit: 50, search: 'bolt' });
  });

  it.each([
    ['page below 1', { page: '0' }],
    ['limit above the maximum', { limit: '101' }],
    ['a non-numeric page', { page: 'abc' }],
  ])('rejects %s', (_label, query) => {
    expect(validateSync(parse(query))).not.toHaveLength(0);
  });
});

describe('paginate', () => {
  it('computes skip and page metadata', () => {
    const query = { page: 2, limit: 10 };

    expect(toSkip(query)).toBe(10);
    expect(paginate(['a', 'b'], 25, query)).toEqual({
      data: ['a', 'b'],
      meta: {
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      },
    });
  });

  it('handles an empty result', () => {
    expect(paginate([], 0, { page: 1, limit: 20 }).meta).toMatchObject({
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });
});
