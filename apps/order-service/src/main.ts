import { bootstrapHttpService, connectEventConsumer } from '@ims/common';
import { EventQueue } from '@ims/events';
import { AppModule } from './app.module';
import { env } from './config/env';

void bootstrapHttpService(AppModule, {
  serviceName: 'order-service',
  description: 'Orders, and the saga that reserves stock for them.',
  port: env.PORT,
  beforeListen: (app) =>
    connectEventConsumer(app, {
      url: env.RABBITMQ_URL,
      queue: EventQueue.Order,
    }),
});
