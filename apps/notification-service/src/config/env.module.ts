import { Global, Module } from '@nestjs/common';
import { env } from './env';
import { NOTIFICATION_ENV } from './env.schema';

/** Makes the validated environment injectable: `@Inject(NOTIFICATION_ENV)`. */
@Global()
@Module({
  providers: [{ provide: NOTIFICATION_ENV, useValue: env }],
  exports: [NOTIFICATION_ENV],
})
export class EnvModule {}
