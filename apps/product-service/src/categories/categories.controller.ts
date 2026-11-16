import {
  Paginated,
  PaginationQueryDto,
  Permission,
  RequirePermissions,
} from '@ims/common';
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
import { CategoriesService } from './categories.service';
import {
  CategoryResponse,
  CreateCategoryDto,
  toCategoryResponse,
  UpdateCategoryDto,
} from './dto/category.dto';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @RequirePermissions(Permission.ProductsRead)
  @ApiOperation({ summary: 'List categories (paginated, searchable by name)' })
  async list(
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<CategoryResponse>> {
    const page = await this.categories.list(query);
    return { ...page, data: page.data.map(toCategoryResponse) };
  }

  @Get(':id')
  @RequirePermissions(Permission.ProductsRead)
  @ApiOperation({ summary: 'Get one category' })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<CategoryResponse> {
    return toCategoryResponse(await this.categories.getById(id));
  }

  @Post()
  @RequirePermissions(Permission.ProductsWrite)
  @ApiOperation({ summary: 'Create a category' })
  async create(@Body() dto: CreateCategoryDto): Promise<CategoryResponse> {
    return toCategoryResponse(await this.categories.create(dto));
  }

  @Patch(':id')
  @RequirePermissions(Permission.ProductsWrite)
  @ApiOperation({ summary: 'Rename or re-describe a category' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponse> {
    return toCategoryResponse(await this.categories.update(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.ProductsWrite)
  @ApiOperation({ summary: 'Delete a category that has no products' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categories.remove(id);
  }
}
