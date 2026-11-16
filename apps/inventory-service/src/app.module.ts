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
import { ReservationsModule } from './reservations/reservations.module';
import { StockReservation } from './reservations/stock-reservation.entity';
import { SeedModule } from './seed/seed.module';
import { StockItem } from './stock/stock-item.entity';
import { StockMovement } from './stock/stock-movement.entity';
import { StockModule } from './stock/stock.module';

@Module({
  imports: [
    EnvModule,
    createLoggerModule({
      serviceName: 'inventory-service',
      level: env.LOG_LEVEL,
      pretty: env.NODE_ENV === 'development',
    }),
    TypeOrmModule.forRoot(
      buildTypeOrmOptions(env, {
        entities: [
          StockItem,
          StockMovement,
          StockReservation,
          ...messagingEntities,
        ],
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
    StockModule,
    ReservationsModule,
    SeedModule,
  ],
})
export class AppModule {}
