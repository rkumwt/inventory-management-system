import {
  AuthGuardModule,
  createLoggerModule,
  EventPublisherModule,
} from '@ims/common';
import {
  buildTypeOrmOptions,
  DatabaseHealthModule,
  messagingEntities,
  OutboxModule,
} from '@ims/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { env } from './config/env';
import { EnvModule } from './config/env.module';
import { migrations } from './database/migrations';
import { Order, OrderItem } from './orders/order.entity';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    EnvModule,
    createLoggerModule({
      serviceName: 'order-service',
      level: env.LOG_LEVEL,
      pretty: env.NODE_ENV === 'development',
    }),
    TypeOrmModule.forRoot(
      buildTypeOrmOptions(env, {
        entities: [Order, OrderItem, ...messagingEntities],
        migrations,
      }),
    ),
    AuthGuardModule.forRoot({ accessSecret: env.JWT_ACCESS_SECRET }),
    EventPublisherModule.forRoot({ url: env.RABBITMQ_URL }),
    OutboxModule.forRoot({
      enabled: env.OUTBOX_RELAY_ENABLED,
      pollIntervalMs: env.OUTBOX_POLL_INTERVAL_MS,
    }),
    DatabaseHealthModule,
    OrdersModule,
  ],
})
export class AppModule {}
