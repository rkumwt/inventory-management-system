import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { getCorrelationId } from '../correlation/correlation';
import { ErrorResponse } from './error-response';

/**
 * Global filter that turns every thrown value into an {@link ErrorResponse}.
 * Unknown errors become a generic 500 so internals never leak to clients;
 * the full error is logged with the correlation ID instead.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const body: ErrorResponse = {
      ...this.describe(exception),
      correlationId: getCorrelationId(),
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url,
    };

    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${body.path} -> ${body.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(body.statusCode).json(body);
  }

  private describe(
    exception: unknown,
  ): Pick<ErrorResponse, 'statusCode' | 'error' | 'message' | 'details'> {
    if (!(exception instanceof HttpException)) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      };
    }

    const statusCode = exception.getStatus();
    const payload = exception.getResponse();
    const fallbackCode = HttpStatus[statusCode] ?? 'ERROR';

    if (typeof payload === 'string') {
      return { statusCode, error: fallbackCode, message: payload };
    }

    const { message, error, details } = payload as {
      message?: string | string[];
      error?: string;
      details?: unknown;
    };

    // class-validator failures arrive as an array of messages.
    if (Array.isArray(message)) {
      return {
        statusCode,
        error: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: message,
      };
    }

    return {
      statusCode,
      // Services may pass their own code: new ConflictException({ error: 'INSUFFICIENT_STOCK', message })
      error: error && /^[A-Z0-9_]+$/.test(error) ? error : fallbackCode,
      message: message ?? exception.message,
      ...(details !== undefined ? { details } : {}),
    };
  }
}
