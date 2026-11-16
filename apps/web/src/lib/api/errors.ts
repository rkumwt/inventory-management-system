import { ApiError } from './client';

/** A sentence that is safe and useful to show to the user. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'VALIDATION_FAILED' && Array.isArray(error.details)) {
      return error.details.map(String).join('. ');
    }
    if (error.status === 403) {
      return 'You do not have permission to do that.';
    }
    if (error.status === 429) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

/** Client errors will not get better on a retry; server and network ones may. */
export function isRetryable(error: unknown): boolean {
  return (
    !(error instanceof ApiError) || error.status === 0 || error.status >= 500
  );
}
