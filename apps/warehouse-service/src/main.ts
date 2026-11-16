import { bootstrapHttpService } from '@ims/common';
import { AppModule } from './app.module';
import { env } from './config/env';

void bootstrapHttpService(AppModule, {
  serviceName: 'warehouse-service',
  description: 'Warehouses and the storage locations inside them.',
  port: env.PORT,
});
