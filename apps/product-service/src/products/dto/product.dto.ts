import { PaginationQueryDto, QueryBoolean } from '@ims/common';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import type { ProductAttributes } from '../product.entity';
import { Product, ProductUnit } from '../product.entity';

const MAX_PRICE = 9_999_999_999.99; // numeric(12, 2)
const MAX_ATTRIBUTES = 50;

/** True for a flat object whose values are strings, numbers or booleans. */
export function isProductAttributes(
  value: unknown,
): value is ProductAttributes {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const entries = Object.entries(value);
  return (
    entries.length <= MAX_ATTRIBUTES &&
    entries.every(([, item]) =>
      ['string', 'number', 'boolean'].includes(typeof item),
    )
  );
}

function IsProductAttributes(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'isProductAttributes',
      target: target.constructor,
      propertyName: String(propertyName),
      options: {
        message: `${String(propertyName)} must be a flat object of string, number or boolean values (at most ${MAX_ATTRIBUTES})`,
        ...options,
      },
      validator: { validate: isProductAttributes },
    });
}

export class CreateProductDto {
  @ApiProperty({
    example: 'DRL-18V-001',
    description: 'Letters, digits, dot, dash, underscore. Stored upper-cased.',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/, {
    message:
      'sku must be 2-64 characters: letters, digits, ".", "-" or "_", starting with a letter or digit',
  })
  sku!: string;

  @ApiProperty({ example: 'Cordless Drill 18V', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiProperty({ example: 129.99, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_PRICE)
  price!: number;

  @ApiProperty({ enum: ProductUnit, example: ProductUnit.Piece })
  @IsEnum(ProductUnit)
  unit!: ProductUnit;

  @ApiPropertyOptional({
    example: { voltage: 18, color: 'blue', cordless: true },
    description: 'Flat key/value details. Stored as JSONB and filterable.',
  })
  @IsOptional()
  @IsProductAttributes()
  attributes?: ProductAttributes;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiPropertyOptional({
    description: 'Set to true to restore an archived product',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export enum ProductSortField {
  Name = 'name',
  Sku = 'sku',
  Price = 'price',
  CreatedAt = 'createdAt',
}

/** `?attributes={"color":"red"}` arrives as a JSON string. */
const parseJson = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

export class ProductQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Omit to include archived products' })
  @IsOptional()
  @QueryBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: String,
    example: '{"color":"blue"}',
    description:
      'JSON object; matches products containing all given attributes',
  })
  @IsOptional()
  @Transform(parseJson)
  @IsProductAttributes()
  attributes?: ProductAttributes;

  @ApiPropertyOptional({
    enum: ProductSortField,
    default: ProductSortField.Name,
  })
  @IsOptional()
  @IsEnum(ProductSortField)
  sortBy: ProductSortField = ProductSortField.Name;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'asc';
}

export class ProductCategoryResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Power Tools' })
  name!: string;
}

export class ProductResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'DRL-18V-001' })
  sku!: string;

  @ApiProperty({ example: 'Cordless Drill 18V' })
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ example: 129.99 })
  price!: number;

  @ApiProperty({ enum: ProductUnit })
  unit!: ProductUnit;

  @ApiProperty({ example: { voltage: 18, color: 'blue' } })
  attributes!: ProductAttributes;

  @ApiProperty({ type: ProductCategoryResponse, nullable: true })
  category!: ProductCategoryResponse | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export function toProductResponse(product: Product): ProductResponse {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    price: product.price,
    unit: product.unit,
    attributes: product.attributes,
    category: product.category
      ? { id: product.category.id, name: product.category.name }
      : null,
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
