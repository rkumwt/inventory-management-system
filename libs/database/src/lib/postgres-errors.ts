import { QueryFailedError } from 'typeorm';

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

function hasCode(error: unknown, code: string): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string }).code === code
  );
}

/**
 * True when a write hit a UNIQUE constraint. Services check for duplicates
 * before writing to give a friendly error, but two concurrent requests can
 * both pass that check; the constraint is the real guard.
 */
export function isUniqueViolation(error: unknown): boolean {
  return hasCode(error, UNIQUE_VIOLATION);
}

/** True when a write or delete was blocked by a FOREIGN KEY constraint. */
export function isForeignKeyViolation(error: unknown): boolean {
  return hasCode(error, FOREIGN_KEY_VIOLATION);
}
