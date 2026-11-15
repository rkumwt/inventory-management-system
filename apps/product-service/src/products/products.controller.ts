import { Paginated, Permission, RequirePermissions } from '@ims/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateProductDto,
  ProductQueryDto,
  ProductResponse,
  toProductResponse,
  UpdateProductDto,
} from './dto/product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermissions(Permission.ProductsRead)
  @ApiOperation({
    summary: 'List products (paginated, searchable, filterable, sortable)',
  })
  async list(
    @Query() query: ProductQueryDto,
  ): Promise<Paginated<ProductResponse>> {
    const page = await this.products.list(query);
    return { ...page, data: page.data.map(toProductResponse) };
  }

  @Get(':id')
  @RequirePermissions(Permission.ProductsRead)
  @ApiOperation({ summary: 'Get one product' })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<ProductResponse> {
    return toProductResponse(await this.products.getById(id));
  }

  @Post()
  @RequirePermissions(Permission.ProductsWrite)
  @ApiOperation({ summary: 'Create a product' })
  async create(@Body() dto: CreateProductDto): Promise<ProductResponse> {
    return toProductResponse(await this.products.create(dto));
  }

  @Patch(':id')
  @RequirePermissions(Permission.ProductsWrite)
  @ApiOperation({ summary: 'Update a product (or restore an archived one)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponse> {
    return toProductResponse(await this.products.update(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.ProductsWrite)
  @ApiOperation({ summary: 'Archive a product (it is never hard-deleted)' })
  archive(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.products.archive(id);
  }
}
