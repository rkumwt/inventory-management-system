import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { IsOptional, validateSync } from 'class-validator';
import { parseQueryBoolean, QueryBoolean } from './query-boolean';

class Query {
  @IsOptional()
  @QueryBoolean()
  isActive?: boolean;
}

const parse = (input: object) => {
  const query = plainToInstance(Query, input);
  return { query, errors: validateSync(query) };
};

describe('QueryBoolean', () => {
  it('converts the literals true and false', () => {
    expect(parse({ isActive: 'true' }).query.isActive).toBe(true);
    expect(parse({ isActive: 'false' }).query.isActive).toBe(false);
  });

  it('rejects anything else instead of guessing', () => {
    expect(parse({ isActive: 'yes' }).errors).toHaveLength(1);
    expect(parse({ isActive: '0' }).errors).toHaveLength(1);
  });

  it('allows the parameter to be omitted', () => {
    expect(parse({}).errors).toHaveLength(0);
  });

  it('parseQueryBoolean leaves other values untouched', () => {
    expect(parseQueryBoolean('maybe')).toBe('maybe');
    expect(parseQueryBoolean(true)).toBe(true);
  });
});
