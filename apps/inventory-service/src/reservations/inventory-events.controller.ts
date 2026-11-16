import { consumeEvent } from '@ims/common';
import { EventName } from '@ims/events';
import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { ReservationsService } from './reservations.service';

/** RabbitMQ subscriptions. Each pattern becomes a binding on the queue. */
@Controller()
export class InventoryEventsController {
  constructor(private readonly reservations: ReservationsService) {}

  @EventPattern(EventName.OrderCreated)
  onOrderCreated(@Payload() data: unknown, @Ctx() context: RmqContext) {
    return consumeEvent(context, data, EventName.OrderCreated, (event) =>
      this.reservations.handleOrderCreated(event),
    );
  }

  @EventPattern(EventName.OrderCancelled)
  onOrderCancelled(@Payload() data: unknown, @Ctx() context: RmqContext) {
    return consumeEvent(context, data, EventName.OrderCancelled, (event) =>
      this.reservations.handleOrderCancelled(event),
    );
  }
}
