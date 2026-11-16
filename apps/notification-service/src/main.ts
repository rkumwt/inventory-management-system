import { bootstrapHttpService, connectEventConsumer } from '@ims/common';
import { EventQueue } from '@ims/events';
import { AppModule } from './app.module';
import { env } from './config/env';

void bootstrapHttpService(AppModule, {
  serviceName: 'notification-service',
  description: 'Turns events into (mock) emails and keeps a record of them.',
  port: env.PORT,
  beforeListen: (app) =>
    connectEventConsumer(app, {
      url: env.RABBITMQ_URL,
      queue: EventQueue.Notification,
    }),
});
