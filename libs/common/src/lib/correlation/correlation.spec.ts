import type { Request, Response } from 'express';
import {
  CORRELATION_ID_HEADER,
  correlationIdMiddleware,
  getCorrelationId,
} from './correlation';

function invoke(headers: Record<string, string>) {
  const req = { headers } as unknown as Request;
  const setHeader = jest.fn();
  const res = { setHeader } as unknown as Response;
  let seenInsideHandler: string | undefined;

  correlationIdMiddleware(req, res, () => {
    seenInsideHandler = getCorrelationId();
  });

  return { req, setHeader, seenInsideHandler };
}

describe('correlationIdMiddleware', () => {
  it('reuses an incoming correlation ID', () => {
    const { setHeader, seenInsideHandler } = invoke({
      [CORRELATION_ID_HEADER]: 'abc-123',
    });

    expect(seenInsideHandler).toBe('abc-123');
    expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, 'abc-123');
  });

  it('generates an ID when none is sent and exposes it downstream', () => {
    const { req, seenInsideHandler } = invoke({});

    expect(seenInsideHandler).toMatch(/^[0-9a-f-]{36}$/);
    expect(req.headers[CORRELATION_ID_HEADER]).toBe(seenInsideHandler);
  });

  it('replaces an oversized incoming ID', () => {
    const { seenInsideHandler } = invoke({
      [CORRELATION_ID_HEADER]: 'x'.repeat(500),
    });

    expect(seenInsideHandler).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('does not leak the ID outside the request', () => {
    invoke({ [CORRELATION_ID_HEADER]: 'abc-123' });

    expect(getCorrelationId()).toBeUndefined();
  });
});
