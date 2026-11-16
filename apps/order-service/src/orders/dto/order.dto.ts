import { PaginationQueryDto } from '@ims/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderStatus } from '../../saga/order-state';
import { Order } from '../order.entity';

export class OrderItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(100_000)
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Warehouse the order is fulfilled from',
  })
  @IsUUID()
  warehouseId!: string;

  @ApiProperty({ type: [OrderItemDto], minItems: 1, maxItems: 50 })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique((item: OrderItemDto) => item.productId, {
    message: 'each product may appear only once in items',
  })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiPropertyOptional({ example: 'Deliver before Friday', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CancelOrderDto {
  @ApiPropertyOptional({ example: 'Customer changed their mind' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class OrderQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class OrderItemResponse {
  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ example: 'DRL-18V-001' })
  sku!: string;

  @ApiProperty({ example: 'Cordless Drill 18V' })
  productName!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty({ example: 129.99 })
  unitPrice!: number;

  @ApiProperty({ example: 259.98 })
  lineTotal!: number;
}

export class OrderResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ORD-20261116-K3F9QZ' })
  orderNumber!: string;

  @ApiProperty({ format: 'uuid' })
  warehouseId!: string;

  @ApiProperty({ enum: OrderStatus })
  status!: OrderStatus;

  @ApiProperty({ example: 259.98 })
  totalAmount!: number;

  @ApiProperty({ nullable: true, type: String })
  note!: string | null;

  @ApiProperty({ nullable: true, type: String })
  cancellationReason!: string | null;

  @ApiProperty({ format: 'uuid' })
  createdBy!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: [OrderItemResponse] })
  items!: OrderItemResponse[];
}

export function toOrderResponse(order: Order): OrderResponse {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    warehouseId: order.warehouseId,
    status: order.status,
    totalAmount: order.totalAmount,
    note: order.note,
    cancellationReason: order.cancellationReason,
    createdBy: order.createdBy,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: (order.items ?? []).map((item) => ({
      productId: item.productId,
      sku: item.sku,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
  };
}
