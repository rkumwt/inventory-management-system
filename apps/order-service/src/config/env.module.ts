import { Global, Module } from '@nestjs/common';
import { env } from './env';
import { ORDER_ENV } from './env.schema';

/** Makes the validated environment injectable: `@Inject(ORDER_ENV)`. */
@Global()
@Module({
  providers: [{ provide: ORDER_ENV, useValue: env }],
  exports: [ORDER_ENV],
})
export class EnvModule {}
