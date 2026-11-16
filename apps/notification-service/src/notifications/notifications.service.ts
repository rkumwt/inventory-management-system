import { Paginated, paginate, toSkip } from '@ims/common';
import { processOnce } from '@ims/database';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NOTIFICATION_ENV, NotificationEnv } from '../config/env.schema';
import { NotificationQueryDto } from './dto/notification.dto';
import { EMAIL_SENDER } from './email-sender';
import type { EmailSender } from './email-sender';
import { buildEmail, NotifiableEvent } from './notification-templates';
import { Notification } from './notification.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(EMAIL_SENDER) private readonly sender: EmailSender,
    @Inject(NOTIFICATION_ENV)
    private readonly config: Pick<NotificationEnv, 'LOW_STOCK_ALERT_EMAIL'>,
  ) {}

  /**
   * Sends one email per event, exactly once in the database's eyes: the
   * event ID and the notification record are written in one transaction.
   * The send happens inside it, so a failed send rolls everything back and
   * the redelivered event tries again.
   */
  async notify(event: NotifiableEvent): Promise<void> {
    const email = buildEmail(event, {
      lowStockAlertEmail: this.config.LOW_STOCK_ALERT_EMAIL,
    });

    const processed = await processOnce(
      this.dataSource,
      event,
      async (manager) => {
        await manager.insert(Notification, {
          ...email,
          eventId: event.eventId,
          correlationId: event.correlationId,
        });
        await this.sender.send(email);
      },
    );
    if (!processed) {
      this.logger.log(
        `Skipped duplicate ${event.eventName} ${event.eventId} (already processed)`,
      );
    }
  }

  async list(query: NotificationQueryDto): Promise<Paginated<Notification>> {
    const [rows, total] = await this.dataSource
      .getRepository(Notification)
      .findAndCount({
        where: query.type ? { type: query.type } : {},
        order: { createdAt: 'DESC', id: 'ASC' },
        skip: toSkip(query),
        take: query.limit,
      });
    return paginate(rows, total, query);
  }
}
