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
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CancelOrderDto,
  CreateOrderDto,
  OrderQueryDto,
  OrderResponse,
  toOrderResponse,
} from './dto/order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @RequirePermissions(Permission.OrdersRead)
  @ApiOperation({
    summary: 'List orders, newest first (filter by status, warehouse, number)',
  })
  async list(@Query() query: OrderQueryDto): Promise<Paginated<OrderResponse>> {
    const page = await this.orders.list(query);
    return { ...page, data: page.data.map(toOrderResponse) };
  }

  @Get(':id')
  @RequirePermissions(Permission.OrdersRead)
  @ApiOperation({ summary: 'One order with its items' })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<OrderResponse> {
    return toOrderResponse(await this.orders.getById(id));
  }

  @Post()
  @RequirePermissions(Permission.OrdersCreate)
  @ApiOperation({
    summary:
      'Place an order. Returns PENDING; stock is reserved asynchronously',
  })
  async create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: AuthUser,
    @Headers('authorization') authorization: string,
  ): Promise<OrderResponse> {
    return toOrderResponse(
      await this.orders.create(dto, {
        userId: user.id,
        email: user.email,
        authorization,
      }),
    );
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.OrdersCancel)
  @ApiOperation({ summary: 'Cancel a pending or confirmed order' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
  ): Promise<OrderResponse> {
    return toOrderResponse(await this.orders.cancel(id, dto.reason));
  }
}
