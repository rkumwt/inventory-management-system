import { bootstrapHttpService, connectEventConsumer } from '@ims/common';
import { EventQueue } from '@ims/events';
import { AppModule } from './app.module';
import { env } from './config/env';

void bootstrapHttpService(AppModule, {
  serviceName: 'inventory-service',
  description:
    'Stock levels per product and warehouse, and every movement that changed them.',
  port: env.PORT,
  beforeListen: (app) =>
    connectEventConsumer(app, {
      url: env.RABBITMQ_URL,
      queue: EventQueue.Inventory,
    }),
});
