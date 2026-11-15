import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { correlationIdMiddleware } from '../correlation/correlation';
import { AllExceptionsFilter } from '../errors/all-exceptions.filter';

export interface HttpAppOptions {
  /** Shown in Swagger and used as the docs title. */
  serviceName: string;
  description?: string;
  /** Origins allowed by CORS. Internal services can pass an empty list. */
  corsOrigins?: string[];
  /** Path the Swagger UI is served on. Defaults to `docs`. */
  swaggerPath?: string;
}

/**
 * Applies the cross-cutting HTTP setup every service shares, so each
 * `main.ts` stays a few lines long and no service can forget a piece:
 * Pino logger, correlation ID, Helmet, CORS, validation, error format,
 * graceful shutdown and Swagger.
 *
 * The app must import `createLoggerModule(...)` and be created with
 * `{ bufferLogs: true }`.
 */
export function configureHttpApp(
  app: INestApplication,
  options: HttpAppOptions,
): void {
  app.useLogger(app.get(Logger));

  // Must be first so every later middleware and log line sees the ID.
  app.use(correlationIdMiddleware);
  app.use(helmet());
  app.enableCors({
    origin: options.corsOrigins ?? [],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Lets Nest run onModuleDestroy / onApplicationShutdown on SIGTERM/SIGINT:
  // stop accepting requests, finish in-flight work, close DB and broker.
  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(options.serviceName)
      .setDescription(options.description ?? '')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup(options.swaggerPath ?? 'docs', app, document);
}
