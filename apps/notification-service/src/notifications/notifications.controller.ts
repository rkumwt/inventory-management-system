import {
  consumeEvent,
  Paginated,
  Permission,
  RequirePermissions,
} from '@ims/common';
import { EventName } from '@ims/events';
import { Controller, Get, Query } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  NotificationQueryDto,
  NotificationResponse,
  toNotificationResponse,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('notifications')
  @ApiBearerAuth()
  @RequirePermissions(Permission.NotificationsRead)
  @ApiOperation({ summary: 'Emails that were sent, newest first' })
  async list(
    @Query() query: NotificationQueryDto,
  ): Promise<Paginated<NotificationResponse>> {
    const page = await this.notifications.list(query);
    return { ...page, data: page.data.map(toNotificationResponse) };
  }

  // RabbitMQ subscriptions. Each pattern becomes a binding on the queue.

  @EventPattern(EventName.OrderConfirmed)
  onOrderConfirmed(@Payload() data: unknown, @Ctx() context: RmqContext) {
    return consumeEvent(context, data, EventName.OrderConfirmed, (event) =>
      this.notifications.notify(event),
    );
  }

  @EventPattern(EventName.OrderCancelled)
  onOrderCancelled(@Payload() data: unknown, @Ctx() context: RmqContext) {
    return consumeEvent(context, data, EventName.OrderCancelled, (event) =>
      this.notifications.notify(event),
    );
  }

  @EventPattern(EventName.LowStockDetected)
  onLowStock(@Payload() data: unknown, @Ctx() context: RmqContext) {
    return consumeEvent(context, data, EventName.LowStockDetected, (event) =>
      this.notifications.notify(event),
    );
  }
}
