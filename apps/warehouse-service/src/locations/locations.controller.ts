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
import {
  CreateLocationDto,
  LocationResponse,
  toLocationResponse,
  UpdateLocationDto,
} from './dto/location.dto';
import { LocationsService } from './locations.service';

@ApiTags('storage locations')
@ApiBearerAuth()
@Controller('warehouses/:warehouseId/locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  @RequirePermissions(Permission.WarehousesRead)
  @ApiOperation({ summary: "List a warehouse's storage locations" })
  async list(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<LocationResponse>> {
    const page = await this.locations.list(warehouseId, query);
    return { ...page, data: page.data.map(toLocationResponse) };
  }

  @Get(':id')
  @RequirePermissions(Permission.WarehousesRead)
  @ApiOperation({ summary: 'Get one storage location' })
  async get(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LocationResponse> {
    return toLocationResponse(await this.locations.getById(warehouseId, id));
  }

  @Post()
  @RequirePermissions(Permission.WarehousesWrite)
  @ApiOperation({ summary: 'Add a storage location to a warehouse' })
  async create(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Body() dto: CreateLocationDto,
  ): Promise<LocationResponse> {
    return toLocationResponse(await this.locations.create(warehouseId, dto));
  }

  @Patch(':id')
  @RequirePermissions(Permission.WarehousesWrite)
  @ApiOperation({ summary: 'Update a storage location' })
  async update(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLocationDto,
  ): Promise<LocationResponse> {
    return toLocationResponse(
      await this.locations.update(warehouseId, id, dto),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.WarehousesWrite)
  @ApiOperation({ summary: 'Delete a storage location' })
  remove(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.locations.remove(warehouseId, id);
  }
}
