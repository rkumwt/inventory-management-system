import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { StorageLocation } from '../storage-location.entity';

export class CreateLocationDto {
  @ApiProperty({
    example: 'A-01-03',
    description: 'Unique within the warehouse. Stored upper-cased.',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9-]{0,31}$/, {
    message:
      'code must be 1-32 characters: letters, digits or "-", starting with a letter or digit',
  })
  code!: string;

  @ApiPropertyOptional({ example: 'Aisle A, rack 1, shelf 3', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string | null;
}

export class UpdateLocationDto extends PartialType(CreateLocationDto) {}

export class LocationResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  warehouseId!: string;

  @ApiProperty({ example: 'A-01-03' })
  code!: string;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export function toLocationResponse(
  location: StorageLocation,
): LocationResponse {
  return {
    id: location.id,
    warehouseId: location.warehouseId,
    code: location.code,
    description: location.description,
    createdAt: location.createdAt,
    updatedAt: location.updatedAt,
  };
}
