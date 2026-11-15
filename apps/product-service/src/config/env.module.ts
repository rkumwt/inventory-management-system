import { Global, Module } from '@nestjs/common';
import { env } from './env';
import { PRODUCT_ENV } from './env.schema';

/** Makes the validated environment injectable: `@Inject(PRODUCT_ENV)`. */
@Global()
@Module({
  providers: [{ provide: PRODUCT_ENV, useValue: env }],
  exports: [PRODUCT_ENV],
})
export class EnvModule {}
