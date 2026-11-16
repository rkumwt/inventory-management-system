import { AuthGuardModule, createLoggerModule } from '@ims/common';
import { buildTypeOrmOptions, DatabaseHealthModule } from '@ims/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { env } from './config/env';
import { EnvModule } from './config/env.module';
import { migrations } from './database/migrations';
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
        entities: [StockItem, StockMovement],
        migrations,
      }),
    ),
    AuthGuardModule.forRoot({ accessSecret: env.JWT_ACCESS_SECRET }),
    DatabaseHealthModule,
    StockModule,
    SeedModule,
  ],
})
export class AppModule {}
