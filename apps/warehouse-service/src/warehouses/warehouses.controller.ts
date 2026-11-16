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
  CreateWarehouseDto,
  toWarehouseResponse,
  UpdateWarehouseDto,
  WarehouseQueryDto,
  WarehouseResponse,
} from './dto/warehouse.dto';
import { WarehousesService } from './warehouses.service';

@ApiTags('warehouses')
@ApiBearerAuth()
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Get()
  @RequirePermissions(Permission.WarehousesRead)
  @ApiOperation({
    summary: 'List warehouses (paginated, searchable by code, name or city)',
  })
  async list(
    @Query() query: WarehouseQueryDto,
  ): Promise<Paginated<WarehouseResponse>> {
    const page = await this.warehouses.list(query);
    return { ...page, data: page.data.map(toWarehouseResponse) };
  }

  @Get(':id')
  @RequirePermissions(Permission.WarehousesRead)
  @ApiOperation({ summary: 'Get one warehouse' })
  async get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WarehouseResponse> {
    return toWarehouseResponse(await this.warehouses.getById(id));
  }

  @Post()
  @RequirePermissions(Permission.WarehousesWrite)
  @ApiOperation({ summary: 'Create a warehouse' })
  async create(@Body() dto: CreateWarehouseDto): Promise<WarehouseResponse> {
    return toWarehouseResponse(await this.warehouses.create(dto));
  }

  @Patch(':id')
  @RequirePermissions(Permission.WarehousesWrite)
  @ApiOperation({ summary: 'Update a warehouse (or restore an archived one)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarehouseDto,
  ): Promise<WarehouseResponse> {
    return toWarehouseResponse(await this.warehouses.update(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.WarehousesWrite)
  @ApiOperation({ summary: 'Archive a warehouse (it is never hard-deleted)' })
  archive(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.warehouses.archive(id);
  }
}
