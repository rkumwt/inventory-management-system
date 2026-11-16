import type { AuthUser } from '@ims/common';
import {
  CurrentUser,
  Paginated,
  Permission,
  RequirePermissions,
} from '@ims/common';
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AdjustStockDto,
  MovementQueryDto,
  MovementResponse,
  SetThresholdDto,
  StockChangeResponse,
  StockItemResponse,
  StockQueryDto,
  toMovementResponse,
  toStockItemResponse,
  TransferResponse,
  TransferStockDto,
} from './dto/stock.dto';
import { StockChange, StockService } from './stock.service';

const toChangeResponse = (change: StockChange): StockChangeResponse => ({
  stock: toStockItemResponse(change.stock),
  movement: toMovementResponse(change.movement),
});

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get()
  @RequirePermissions(Permission.InventoryRead)
  @ApiOperation({
    summary: 'Stock levels, filterable by product, warehouse and low stock',
  })
  async list(
    @Query() query: StockQueryDto,
  ): Promise<Paginated<StockItemResponse>> {
    const page = await this.stock.list(query);
    return { ...page, data: page.data.map(toStockItemResponse) };
  }

  // Declared before ':id' so "movements" is not read as an ID.
  @Get('movements')
  @RequirePermissions(Permission.InventoryRead)
  @ApiOperation({ summary: 'Movement history, newest first' })
  async movements(
    @Query() query: MovementQueryDto,
  ): Promise<Paginated<MovementResponse>> {
    const page = await this.stock.listMovements(query);
    return { ...page, data: page.data.map(toMovementResponse) };
  }

  @Get(':id')
  @RequirePermissions(Permission.InventoryRead)
  @ApiOperation({ summary: 'One stock item' })
  async get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StockItemResponse> {
    return toStockItemResponse(await this.stock.getById(id));
  }

  @Post('stock-in')
  @RequirePermissions(Permission.InventoryAdjust)
  @ApiOperation({ summary: 'Receive stock into a warehouse' })
  async stockIn(
    @Body() dto: AdjustStockDto,
    @CurrentUser() user: AuthUser,
    @Headers('authorization') authorization: string,
  ): Promise<StockChangeResponse> {
    return toChangeResponse(
      await this.stock.stockIn(dto, { userId: user.id, authorization }),
    );
  }

  @Post('stock-out')
  @RequirePermissions(Permission.InventoryAdjust)
  @ApiOperation({ summary: 'Remove available stock from a warehouse' })
  async stockOut(
    @Body() dto: AdjustStockDto,
    @CurrentUser() user: AuthUser,
    @Headers('authorization') authorization: string,
  ): Promise<StockChangeResponse> {
    return toChangeResponse(
      await this.stock.stockOut(dto, { userId: user.id, authorization }),
    );
  }

  @Post('transfer')
  @RequirePermissions(Permission.InventoryTransfer)
  @ApiOperation({ summary: 'Move stock between two warehouses, atomically' })
  async transfer(
    @Body() dto: TransferStockDto,
    @CurrentUser() user: AuthUser,
    @Headers('authorization') authorization: string,
  ): Promise<TransferResponse> {
    const result = await this.stock.transfer(dto, {
      userId: user.id,
      authorization,
    });
    return {
      transferId: result.transferId,
      source: toStockItemResponse(result.source),
      destination: toStockItemResponse(result.destination),
    };
  }

  @Patch(':id/threshold')
  @RequirePermissions(Permission.InventoryAdjust)
  @ApiOperation({ summary: 'Set the low-stock threshold of a stock item' })
  async setThreshold(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetThresholdDto,
  ): Promise<StockItemResponse> {
    return toStockItemResponse(
      await this.stock.setThreshold(id, dto.lowStockThreshold),
    );
  }
}
