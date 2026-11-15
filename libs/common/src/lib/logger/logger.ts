import { DynamicModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import {
  CORRELATION_ID_HEADER,
  getCorrelationId,
} from '../correlation/correlation';

export interface LoggerOptions {
  serviceName: string;
  level: string;
  /** Human-readable output for local development; JSON everywhere else. */
  pretty: boolean;
}

/**
 * Structured JSON logging (Pino) shared by every service. Each line carries
 * the service name and, when inside a request or event handler, the
 * correlation ID, so one request can be followed across services.
 */
export function createLoggerModule(options: LoggerOptions): DynamicModule {
  return LoggerModule.forRoot({
    pinoHttp: {
      name: options.serviceName,
      level: options.level,
      genReqId: (req) => {
        const header = req.headers[CORRELATION_ID_HEADER];
        return (Array.isArray(header) ? header[0] : header) ?? 'unknown';
      },
      mixin: () => {
        const correlationId = getCorrelationId();
        return correlationId ? { correlationId } : {};
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
        ],
        censor: '[REDACTED]',
      },
      autoLogging: {
        ignore: (req) => req.url?.startsWith('/health') ?? false,
      },
      transport: options.pretty
        ? {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' },
          }
        : undefined,
    },
  });
}
