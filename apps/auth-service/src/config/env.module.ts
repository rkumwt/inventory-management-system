import { Global, Module } from '@nestjs/common';
import { env } from './env';
import { AUTH_ENV } from './env.schema';

/** Makes the validated environment injectable: `@Inject(AUTH_ENV)`. */
@Global()
@Module({
  providers: [{ provide: AUTH_ENV, useValue: env }],
  exports: [AUTH_ENV],
})
export class EnvModule {}
