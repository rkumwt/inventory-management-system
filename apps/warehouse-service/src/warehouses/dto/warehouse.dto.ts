import { PaginationQueryDto, QueryBoolean } from '@ims/common';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Warehouse } from '../warehouse.entity';

export class CreateWarehouseDto {
  @ApiProperty({
    example: 'WH-NYC',
    description: 'Letters, digits and dashes. Stored upper-cased.',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9-]{1,19}$/, {
    message:
      'code must be 2-20 characters: letters, digits or "-", starting with a letter or digit',
  })
  code!: string;

  @ApiProperty({ example: 'New York Distribution Center', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: '500 Harbor Blvd', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string | null;

  @ApiProperty({ example: 'New York', maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  city!: string;

  @ApiProperty({ example: 'United States', maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  country!: string;
}

export class UpdateWarehouseDto extends PartialType(CreateWarehouseDto) {
  @ApiPropertyOptional({
    description: 'Set to true to restore an archived warehouse',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class WarehouseQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Omit to include archived warehouses' })
  @IsOptional()
  @QueryBoolean()
  isActive?: boolean;
}

export class WarehouseResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'WH-NYC' })
  code!: string;

  @ApiProperty({ example: 'New York Distribution Center' })
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  address!: string | null;

  @ApiProperty({ example: 'New York' })
  city!: string;

  @ApiProperty({ example: 'United States' })
  country!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export function toWarehouseResponse(warehouse: Warehouse): WarehouseResponse {
  return {
    id: warehouse.id,
    code: warehouse.code,
    name: warehouse.name,
    address: warehouse.address,
    city: warehouse.city,
    country: warehouse.country,
    isActive: warehouse.isActive,
    createdAt: warehouse.createdAt,
    updatedAt: warehouse.updatedAt,
  };
}
