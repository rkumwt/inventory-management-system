import { AuthGuardModule, createLoggerModule } from '@ims/common';
import { buildTypeOrmOptions, DatabaseHealthModule } from '@ims/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { env } from './config/env';
import { EnvModule } from './config/env.module';
import { migrations } from './database/migrations';
import { LocationsModule } from './locations/locations.module';
import { StorageLocation } from './locations/storage-location.entity';
import { SeedModule } from './seed/seed.module';
import { Warehouse } from './warehouses/warehouse.entity';
import { WarehousesModule } from './warehouses/warehouses.module';

@Module({
  imports: [
    EnvModule,
    createLoggerModule({
      serviceName: 'warehouse-service',
      level: env.LOG_LEVEL,
      pretty: env.NODE_ENV === 'development',
    }),
    TypeOrmModule.forRoot(
      buildTypeOrmOptions(env, {
        entities: [Warehouse, StorageLocation],
        migrations,
      }),
    ),
    AuthGuardModule.forRoot({ accessSecret: env.JWT_ACCESS_SECRET }),
    DatabaseHealthModule,
    WarehousesModule,
    LocationsModule,
    SeedModule,
  ],
})
export class AppModule {}
