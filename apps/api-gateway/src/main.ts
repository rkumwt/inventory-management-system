import { bootstrapHttpService } from '@ims/common';
import { AppModule } from './app.module';
import { env } from './config/env';
import { API_PREFIX } from './proxy/routes';

void bootstrapHttpService(AppModule, {
  serviceName: 'api-gateway',
  description:
    'Single entry point for the frontend. Verifies the JWT, applies rate limits and forwards /v1/* to the owning service. Each service publishes its own API docs at /docs.',
  port: env.PORT,
  corsOrigins: env.CORS_ORIGINS,
  globalPrefix: { prefix: API_PREFIX, exclude: ['health'] },
});
