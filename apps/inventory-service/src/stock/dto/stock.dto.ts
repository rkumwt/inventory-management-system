import { PaginationQueryDto, QueryBoolean } from '@ims/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { StockItem } from '../stock-item.entity';
import { MovementType, StockMovement } from '../stock-movement.entity';
import { availableQuantity, isLowStock } from '../stock-rules';

const MAX_QUANTITY = 1_000_000;

class MovementDetailsDto {
  @ApiPropertyOptional({ example: 'PO-2026-0042', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional({ example: 'Weekly supplier delivery', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Body of `POST /inventory/stock-in` and `POST /inventory/stock-out`. */
export class AdjustStockDto extends MovementDetailsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  warehouseId!: string;

  @ApiProperty({ example: 25, minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity!: number;
}

export class TransferStockDto extends MovementDetailsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  fromWarehouseId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  toWarehouseId!: string;

  @ApiProperty({ example: 10, minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity!: number;
}

export class SetThresholdDto {
  @ApiProperty({ example: 10, minimum: 0 })
  @IsInt()
  @Min(0)
  @Max(MAX_QUANTITY)
  lowStockThreshold!: number;
}

export class StockQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({
    description: 'true: only items at or below their low-stock threshold',
  })
  @IsOptional()
  @QueryBoolean()
  lowStock?: boolean;
}

export class MovementQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({ enum: MovementType })
  @IsOptional()
  @IsEnum(MovementType)
  type?: MovementType;
}

export class StockItemResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ format: 'uuid' })
  warehouseId!: string;

  @ApiProperty({ description: 'Units physically on hand' })
  quantity!: number;

  @ApiProperty({ description: 'Units promised to orders' })
  reservedQuantity!: number;

  @ApiProperty({ description: 'quantity - reservedQuantity' })
  availableQuantity!: number;

  @ApiProperty()
  lowStockThreshold!: number;

  @ApiProperty({ description: 'availableQuantity <= lowStockThreshold' })
  lowStock!: boolean;

  @ApiProperty()
  updatedAt!: Date;
}

export function toStockItemResponse(item: StockItem): StockItemResponse {
  return {
    id: item.id,
    productId: item.productId,
    warehouseId: item.warehouseId,
    quantity: item.quantity,
    reservedQuantity: item.reservedQuantity,
    availableQuantity: availableQuantity(item),
    lowStockThreshold: item.lowStockThreshold,
    lowStock: isLowStock(item),
    updatedAt: item.updatedAt,
  };
}

export class MovementResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ format: 'uuid' })
  warehouseId!: string;

  @ApiProperty({ enum: MovementType })
  type!: MovementType;

  @ApiProperty({ description: 'Always positive' })
  quantity!: number;

  @ApiProperty({ description: 'On-hand quantity right after this movement' })
  quantityAfter!: number;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  transferId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  reference!: string | null;

  @ApiProperty({ nullable: true, type: String })
  note!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  performedBy!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export function toMovementResponse(movement: StockMovement): MovementResponse {
  return {
    id: movement.id,
    productId: movement.productId,
    warehouseId: movement.warehouseId,
    type: movement.type,
    quantity: movement.quantity,
    quantityAfter: movement.quantityAfter,
    transferId: movement.transferId,
    reference: movement.reference,
    note: movement.note,
    performedBy: movement.performedBy,
    createdAt: movement.createdAt,
  };
}

export class StockChangeResponse {
  @ApiProperty({ type: StockItemResponse })
  stock!: StockItemResponse;

  @ApiProperty({ type: MovementResponse })
  movement!: MovementResponse;
}

export class TransferResponse {
  @ApiProperty({ format: 'uuid' })
  transferId!: string;

  @ApiProperty({ type: StockItemResponse })
  source!: StockItemResponse;

  @ApiProperty({ type: StockItemResponse })
  destination!: StockItemResponse;
}
