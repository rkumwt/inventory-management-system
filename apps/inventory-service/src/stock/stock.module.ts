import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  imports: [CatalogModule],
  controllers: [StockController],
  providers: [StockService],
})
export class StockModule {}
