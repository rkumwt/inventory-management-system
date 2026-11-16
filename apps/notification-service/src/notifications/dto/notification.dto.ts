import { PaginationQueryDto } from '@ims/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Notification, NotificationType } from '../notification.entity';

export class NotificationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: NotificationType })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}

export class NotificationResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;

  @ApiProperty({ example: 'staff@ims.local' })
  recipient!: string;

  @ApiProperty({ example: 'Order ORD-20261116-K3F9QZ confirmed' })
  subject!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty()
  createdAt!: Date;
}

export function toNotificationResponse(
  notification: Notification,
): NotificationResponse {
  return {
    id: notification.id,
    type: notification.type,
    recipient: notification.recipient,
    subject: notification.subject,
    body: notification.body,
    createdAt: notification.createdAt,
  };
}
