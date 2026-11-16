import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { OrderEventsController } from '../saga/order-events.controller';
import { OrderSagaService } from '../saga/order-saga.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [CatalogModule],
  controllers: [OrdersController, OrderEventsController],
  providers: [OrdersService, OrderSagaService],
})
export class OrdersModule {}
