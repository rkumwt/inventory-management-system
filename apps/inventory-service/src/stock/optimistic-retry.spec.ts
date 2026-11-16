import {
  MAX_ATTEMPTS,
  VersionConflictError,
  withOptimisticRetry,
} from './optimistic-retry';

describe('withOptimisticRetry', () => {
  it('returns the result when the first attempt succeeds', async () => {
    const work = jest.fn().mockResolvedValue('done');

    await expect(withOptimisticRetry(work)).resolves.toBe('done');
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('runs the work again after losing a version race', async () => {
    const work = jest
      .fn()
      .mockRejectedValueOnce(new VersionConflictError())
      .mockRejectedValueOnce(new VersionConflictError())
      .mockResolvedValue('done');

    await expect(withOptimisticRetry(work)).resolves.toBe('done');
    expect(work).toHaveBeenCalledTimes(3);
  });

  it('gives up after the maximum number of attempts', async () => {
    const work = jest.fn().mockRejectedValue(new VersionConflictError());

    await expect(withOptimisticRetry(work)).rejects.toThrow(
      VersionConflictError,
    );
    expect(work).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });

  it('does not retry other errors, such as a broken business rule', async () => {
    const work = jest.fn().mockRejectedValue(new Error('insufficient stock'));

    await expect(withOptimisticRetry(work)).rejects.toThrow(
      'insufficient stock',
    );
    expect(work).toHaveBeenCalledTimes(1);
  });
});
