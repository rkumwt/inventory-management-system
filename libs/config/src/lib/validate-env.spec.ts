import { z } from 'zod';
import {
  baseEnvSchema,
  databaseEnvSchema,
  httpEnvSchema,
  jwtIssueEnvSchema,
  rabbitmqEnvSchema,
} from './env-schemas';
import { ConfigValidationError, validateEnv } from './validate-env';

const serviceSchema = z.object({
  ...baseEnvSchema.shape,
  ...httpEnvSchema.shape,
  ...databaseEnvSchema.shape,
});

const validEnv = {
  PORT: '3001',
  DB_HOST: 'localhost',
  DB_USER: 'ims',
  DB_PASSWORD: 'secret',
  DB_NAME: 'ims_auth',
};

describe('validateEnv', () => {
  it('coerces values and applies defaults', () => {
    const config = validateEnv(serviceSchema, validEnv);

    expect(config).toEqual({
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
      PORT: 3001,
      CORS_ORIGINS: ['http://localhost:3000'],
      DB_HOST: 'localhost',
      DB_PORT: 5432,
      DB_USER: 'ims',
      DB_PASSWORD: 'secret',
      DB_NAME: 'ims_auth',
      DB_SSL: false,
      DB_MIGRATIONS_RUN: true,
    });
  });

  it('splits comma-separated CORS origins', () => {
    const config = validateEnv(serviceSchema, {
      ...validEnv,
      CORS_ORIGINS: 'http://a.test, http://b.test',
    });

    expect(config.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
  });

  it('throws one error listing every invalid variable', () => {
    const act = () =>
      validateEnv(serviceSchema, { ...validEnv, PORT: 'abc', DB_HOST: '' });

    expect(act).toThrow(ConfigValidationError);
    try {
      act();
    } catch (error) {
      const issues = (error as ConfigValidationError).issues;
      expect(issues).toHaveLength(2);
      expect(issues[0]).toMatch(/^PORT: /);
      expect(issues[1]).toMatch(/^DB_HOST: /);
    }
  });

  it('rejects missing required variables', () => {
    expect(() => validateEnv(serviceSchema, {})).toThrow(/DB_NAME/);
  });

  it('rejects weak JWT secrets', () => {
    expect(() =>
      validateEnv(jwtIssueEnvSchema, {
        JWT_ACCESS_SECRET: 'short',
        JWT_REFRESH_SECRET: 'x'.repeat(32),
      }),
    ).toThrow(/JWT_ACCESS_SECRET: must be at least 32 characters/);
  });

  it('rejects a non-AMQP RabbitMQ URL', () => {
    expect(() =>
      validateEnv(rabbitmqEnvSchema, { RABBITMQ_URL: 'http://localhost' }),
    ).toThrow(/RABBITMQ_URL/);
  });
});
