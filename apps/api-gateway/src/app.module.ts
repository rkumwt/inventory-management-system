import { AuthGuardModule, createLoggerModule } from '@ims/common';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import Redis from 'ioredis';
import { env } from './config/env';
import { HealthModule } from './health/health.module';
import { ProxyModule } from './proxy/proxy.module';
import { REDIS_CLIENT, RedisModule } from './redis/redis.module';

@Module({
  imports: [
    createLoggerModule({
      serviceName: 'api-gateway',
      level: env.LOG_LEVEL,
      pretty: env.NODE_ENV === 'development',
    }),
    RedisModule,
    // Counters live in Redis so the limit holds across gateway instances.
    ThrottlerModule.forRootAsync({
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => ({
        throttlers: [
          {
            name: 'default',
            ttl: env.RATE_LIMIT_WINDOW_SECONDS * 1000,
            limit: env.RATE_LIMIT_MAX,
          },
        ],
        storage: new ThrottlerStorageRedisService(redis),
      }),
    }),
    AuthGuardModule.forRoot({ accessSecret: env.JWT_ACCESS_SECRET }),
    HealthModule,
    ProxyModule, // last: it owns the catch-all route
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
