import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { runWithCorrelationId } from '../correlation/correlation';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { ErrorResponse } from './error-response';

function run(exception: unknown): ErrorResponse {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', originalUrl: '/v1/products/42' }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);

  const body = json.mock.calls[0][0] as ErrorResponse;
  expect(status).toHaveBeenCalledWith(body.statusCode);
  return body;
}

describe('AllExceptionsFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('formats an HttpException', () => {
    const body = run(new NotFoundException('Product 42 not found'));

    expect(body).toMatchObject({
      statusCode: 404,
      error: 'NOT_FOUND',
      message: 'Product 42 not found',
      path: '/v1/products/42',
    });
    expect(Date.parse(body.timestamp)).not.toBeNaN();
  });

  it('turns class-validator messages into VALIDATION_FAILED details', () => {
    const body = run(
      new BadRequestException([
        'sku should not be empty',
        'price must be >= 0',
      ]),
    );

    expect(body).toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_FAILED',
      message: 'Request validation failed',
      details: ['sku should not be empty', 'price must be >= 0'],
    });
  });

  it('keeps a service-defined error code and details', () => {
    const body = run(
      new ConflictException({
        error: 'INSUFFICIENT_STOCK',
        message: 'Not enough stock',
        details: { available: 2, requested: 5 },
      }),
    );

    expect(body).toMatchObject({
      statusCode: 409,
      error: 'INSUFFICIENT_STOCK',
      message: 'Not enough stock',
      details: { available: 2, requested: 5 },
    });
  });

  it('hides internals of unknown errors behind a generic 500 and logs them', () => {
    const body = run(new Error('connection to 10.0.0.5:5432 refused'));

    expect(body).toMatchObject({
      statusCode: 500,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    });
    expect(JSON.stringify(body)).not.toContain('10.0.0.5');
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
  });

  it('includes the correlation ID of the current request', () => {
    const body = runWithCorrelationId('corr-123', () =>
      run(new NotFoundException()),
    );

    expect(body.correlationId).toBe('corr-123');
  });
});
