import { Global, Module } from '@nestjs/common';
import { env } from './env';
import { WAREHOUSE_ENV } from './env.schema';

/** Makes the validated environment injectable: `@Inject(WAREHOUSE_ENV)`. */
@Global()
@Module({
  providers: [{ provide: WAREHOUSE_ENV, useValue: env }],
  exports: [WAREHOUSE_ENV],
})
export class EnvModule {}
