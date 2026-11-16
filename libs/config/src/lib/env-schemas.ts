import { z } from 'zod';

/**
 * Reusable env schema fragments. A service composes only what it needs:
 *
 *   export const authEnvSchema = z.object({
 *     ...baseEnvSchema.shape,
 *     ...httpEnvSchema.shape,
 *     ...databaseEnvSchema.shape,
 *     ...jwtEnvSchema.shape,
 *   });
 *   export type AuthEnv = z.infer<typeof authEnvSchema>;
 */

export const port = z.coerce.number().int().min(1).max(65535);

/** `"true"` / `"false"` env flag, parsed to a boolean. */
export const booleanFlag = (defaultValue: boolean) =>
  z
    .enum(['true', 'false'])
    .default(defaultValue ? 'true' : 'false')
    .transform((value) => value === 'true');

const commaSeparatedList = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

export const baseEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});

/** Base URL of another service, e.g. `http://localhost:4001`. */
export const serviceUrl = z
  .string()
  .regex(/^https?:\/\/.+/, 'must be an http:// or https:// URL')
  .transform((value) => value.replace(/\/+$/, ''));

export const httpEnvSchema = z.object({
  PORT: port,
  CORS_ORIGINS: commaSeparatedList.default(['http://localhost:3000']),
});

export const databaseEnvSchema = z.object({
  DB_HOST: z.string().min(1),
  DB_PORT: port.default(5432),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_SSL: booleanFlag(false),
  /** Apply pending migrations at startup (see Decisions in the README). */
  DB_MIGRATIONS_RUN: booleanFlag(true),
});

export const rabbitmqEnvSchema = z.object({
  RABBITMQ_URL: z
    .string()
    .regex(/^amqps?:\/\/.+/, 'must be an amqp:// or amqps:// URL'),
  /** How often the outbox relay looks for unpublished events. */
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(100).default(1000),
  /** Set to false to stop this instance publishing (tests do this). */
  OUTBOX_RELAY_ENABLED: booleanFlag(true),
});

export const redisEnvSchema = z.object({
  REDIS_URL: z
    .string()
    .regex(/^rediss?:\/\/.+/, 'must be a redis:// or rediss:// URL'),
});

/** Needed by every service that verifies access tokens. */
export const jwtVerifyEnvSchema = z.object({
  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
});

/** Needed only by the service that issues tokens (auth-service). */
export const jwtIssueEnvSchema = z.object({
  ...jwtVerifyEnvSchema.shape,
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_REFRESH_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 7),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;
export type HttpEnv = z.infer<typeof httpEnvSchema>;
export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;
export type RabbitmqEnv = z.infer<typeof rabbitmqEnvSchema>;
export type RedisEnv = z.infer<typeof redisEnvSchema>;
export type JwtVerifyEnv = z.infer<typeof jwtVerifyEnvSchema>;
export type JwtIssueEnv = z.infer<typeof jwtIssueEnvSchema>;
