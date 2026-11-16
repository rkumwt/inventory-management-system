import { Global, Module } from '@nestjs/common';
import { env } from './env';
import { INVENTORY_ENV } from './env.schema';

/** Makes the validated environment injectable: `@Inject(INVENTORY_ENV)`. */
@Global()
@Module({
  providers: [{ provide: INVENTORY_ENV, useValue: env }],
  exports: [INVENTORY_ENV],
})
export class EnvModule {}
