import { Module } from '@nestjs/common';
import { InventoryEventsController } from './inventory-events.controller';
import { ReservationsService } from './reservations.service';

@Module({
  controllers: [InventoryEventsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
