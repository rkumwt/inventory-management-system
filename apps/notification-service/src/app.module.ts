import { AuthGuardModule, createLoggerModule } from '@ims/common';
import {
  buildTypeOrmOptions,
  DatabaseHealthModule,
  ProcessedEvent,
} from '@ims/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { env } from './config/env';
import { EnvModule } from './config/env.module';
import { migrations } from './database/migrations';
import { Notification } from './notifications/notification.entity';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    EnvModule,
    createLoggerModule({
      serviceName: 'notification-service',
      level: env.LOG_LEVEL,
      pretty: env.NODE_ENV === 'development',
    }),
    TypeOrmModule.forRoot(
      buildTypeOrmOptions(env, {
        entities: [Notification, ProcessedEvent],
        migrations,
      }),
    ),
    AuthGuardModule.forRoot({ accessSecret: env.JWT_ACCESS_SECRET }),
    DatabaseHealthModule,
    NotificationsModule,
  ],
})
export class AppModule {}
