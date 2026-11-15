import { AuthGuardModule, createLoggerModule } from '@ims/common';
import { buildTypeOrmOptions, DatabaseHealthModule } from '@ims/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { RefreshToken } from './auth/refresh-token.entity';
import { env } from './config/env';
import { EnvModule } from './config/env.module';
import { migrations } from './database/migrations';
import { SeedModule } from './seed/seed.module';
import { User } from './users/user.entity';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    EnvModule,
    createLoggerModule({
      serviceName: 'auth-service',
      level: env.LOG_LEVEL,
      pretty: env.NODE_ENV === 'development',
    }),
    TypeOrmModule.forRoot(
      buildTypeOrmOptions(env, {
        entities: [User, RefreshToken],
        migrations,
      }),
    ),
    AuthGuardModule.forRoot({ accessSecret: env.JWT_ACCESS_SECRET }),
    DatabaseHealthModule,
    UsersModule,
    AuthModule,
    SeedModule,
  ],
})
export class AppModule {}
