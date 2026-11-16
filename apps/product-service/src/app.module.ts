import { AuthGuardModule, createLoggerModule } from '@ims/common';
import { buildTypeOrmOptions, DatabaseHealthModule } from '@ims/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from './categories/categories.module';
import { Category } from './categories/category.entity';
import { env } from './config/env';
import { EnvModule } from './config/env.module';
import { migrations } from './database/migrations';
import { Product } from './products/product.entity';
import { ProductsModule } from './products/products.module';
import { SeedModule } from './seed/seed.module';

@Module({
  imports: [
    EnvModule,
    createLoggerModule({
      serviceName: 'product-service',
      level: env.LOG_LEVEL,
      pretty: env.NODE_ENV === 'development',
    }),
    TypeOrmModule.forRoot(
      buildTypeOrmOptions(env, {
        entities: [Category, Product],
        migrations,
      }),
    ),
    AuthGuardModule.forRoot({ accessSecret: env.JWT_ACCESS_SECRET }),
    DatabaseHealthModule,
    CategoriesModule,
    ProductsModule,
    SeedModule,
  ],
})
export class AppModule {}
