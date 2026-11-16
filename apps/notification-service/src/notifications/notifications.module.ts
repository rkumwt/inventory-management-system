import { Module } from '@nestjs/common';
import { EMAIL_SENDER, MockEmailSender } from './email-sender';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    // Swap this one line for a real provider (e.g. Amazon SES) in production.
    { provide: EMAIL_SENDER, useClass: MockEmailSender },
  ],
})
export class NotificationsModule {}
