import { bootstrapHttpService } from '@ims/common';
import { AppModule } from './app.module';
import { env } from './config/env';

void bootstrapHttpService(AppModule, {
  serviceName: 'inventory-service',
  description:
    'Stock levels per product and warehouse, and every movement that changed them.',
  port: env.PORT,
});
