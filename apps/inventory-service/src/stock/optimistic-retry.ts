/** Thrown when a versioned UPDATE matched no row: someone else wrote first. */
export class VersionConflictError extends Error {
  constructor() {
    super('Stock item was changed by another request');
    this.name = 'VersionConflictError';
  }
}

export const MAX_ATTEMPTS = 3;

/**
 * Runs `work`, and runs it again from the start if it lost an optimistic-lock
 * race. Each attempt must re-read the data it depends on. After
 * `maxAttempts` the conflict is rethrown for the caller to report.
 */
export async function withOptimisticRetry<T>(
  work: () => Promise<T>,
  maxAttempts = MAX_ATTEMPTS,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (!(error instanceof VersionConflictError) || attempt >= maxAttempts) {
        throw error;
      }
    }
  }
}
