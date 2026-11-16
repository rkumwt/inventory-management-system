import { consumeEvent } from '@ims/common';
import { EventName } from '@ims/events';
import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { OrderSagaService } from './order-saga.service';

/** RabbitMQ subscriptions. Each pattern becomes a binding on the queue. */
@Controller()
export class OrderEventsController {
  constructor(private readonly saga: OrderSagaService) {}

  @EventPattern(EventName.StockReserved)
  onStockReserved(@Payload() data: unknown, @Ctx() context: RmqContext) {
    return consumeEvent(context, data, EventName.StockReserved, (event) =>
      this.saga.handleStockReserved(event),
    );
  }

  @EventPattern(EventName.StockReservationFailed)
  onStockReservationFailed(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    return consumeEvent(
      context,
      data,
      EventName.StockReservationFailed,
      (event) => this.saga.handleStockReservationFailed(event),
    );
  }
}
