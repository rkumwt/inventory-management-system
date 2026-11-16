import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { StorageLocation } from './storage-location.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StorageLocation]), WarehousesModule],
  controllers: [LocationsController],
  providers: [LocationsService],
})
export class LocationsModule {}
