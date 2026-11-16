import {
  baseEnvSchema,
  databaseEnvSchema,
  httpEnvSchema,
  jwtVerifyEnvSchema,
  rabbitmqEnvSchema,
} from '@ims/config';
import { z } from 'zod';

export const notificationEnvSchema = z.object({
  ...baseEnvSchema.shape,
  ...httpEnvSchema.shape,
  ...databaseEnvSchema.shape,
  ...jwtVerifyEnvSchema.shape,
  // Only RABBITMQ_URL is used: this service consumes and never publishes.
  ...rabbitmqEnvSchema.shape,
  /** Recipient of low-stock alerts. */
  LOW_STOCK_ALERT_EMAIL: z.email().default('inventory-alerts@ims.local'),
});

export type NotificationEnv = z.infer<typeof notificationEnvSchema>;

/** Injection token for the validated environment. */
export const NOTIFICATION_ENV = Symbol('NOTIFICATION_ENV');
