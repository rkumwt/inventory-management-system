import { Injectable, Logger } from '@nestjs/common';
import type { Email } from './notification-templates';

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

/** The one method a real provider (e.g. Amazon SES) would implement. */
export interface EmailSender {
  send(email: Email): Promise<void>;
}

/** Stands in for an email provider: writes the email to the log. */
@Injectable()
export class MockEmailSender implements EmailSender {
  private readonly logger = new Logger('MockEmail');

  async send(email: Email): Promise<void> {
    this.logger.log(
      `To: ${email.recipient} | Subject: ${email.subject} | ${email.body}`,
    );
  }
}
