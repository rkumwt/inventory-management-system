import { QueryFailedError } from 'typeorm';
import { isForeignKeyViolation, isUniqueViolation } from './postgres-errors';

const failure = (code: string) =>
  new QueryFailedError('INSERT', [], { code } as never);

describe('postgres error helpers', () => {
  it('recognises a unique violation', () => {
    expect(isUniqueViolation(failure('23505'))).toBe(true);
    expect(isUniqueViolation(failure('23503'))).toBe(false);
  });

  it('recognises a foreign key violation', () => {
    expect(isForeignKeyViolation(failure('23503'))).toBe(true);
    expect(isForeignKeyViolation(failure('23505'))).toBe(false);
  });

  it('ignores errors that did not come from the database', () => {
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isForeignKeyViolation(undefined)).toBe(false);
  });
});
