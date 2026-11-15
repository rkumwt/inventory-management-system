import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

/** `'true'` -> true, `'false'` -> false; anything else is left untouched. */
export function parseQueryBoolean(value: unknown): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

/**
 * For boolean query-string parameters such as `?isActive=true`. Query values
 * arrive as strings, and a plain type conversion would turn `'false'` into
 * `true`. Only the literals `true` and `false` are accepted.
 */
export function QueryBoolean(): PropertyDecorator {
  return (target, propertyKey) => {
    Transform(({ value }) => parseQueryBoolean(value))(target, propertyKey);
    IsBoolean()(target, propertyKey);
  };
}
