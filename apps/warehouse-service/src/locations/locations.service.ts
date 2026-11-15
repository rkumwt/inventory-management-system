import { Paginated, paginate, PaginationQueryDto, toSkip } from '@ims/common';
import { isUniqueViolation } from '@ims/database';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import {
  normalizeCode,
  WarehousesService,
} from '../warehouses/warehouses.service';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';
import { StorageLocation } from './storage-location.entity';

/**
 * Storage locations always belong to one warehouse, so every method takes the
 * warehouse ID and a location is only ever found through its own warehouse.
 */
@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(StorageLocation)
    private readonly locations: Repository<StorageLocation>,
    private readonly warehouses: WarehousesService,
  ) {}

  async list(
    warehouseId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<StorageLocation>> {
    await this.warehouses.getById(warehouseId); // 404 for an unknown warehouse
    const term = query.search ? ILike(`%${query.search}%`) : undefined;

    const [rows, total] = await this.locations.findAndCount({
      where: term
        ? [
            { warehouseId, code: term },
            { warehouseId, description: term },
          ]
        : { warehouseId },
      order: { code: 'ASC' },
      skip: toSkip(query),
      take: query.limit,
    });
    return paginate(rows, total, query);
  }

  async getById(warehouseId: string, id: string): Promise<StorageLocation> {
    const location = await this.locations.findOne({
      where: { id, warehouseId },
    });
    if (!location) {
      throw new NotFoundException(
        `Storage location ${id} not found in warehouse ${warehouseId}`,
      );
    }
    return location;
  }

  async create(
    warehouseId: string,
    dto: CreateLocationDto,
  ): Promise<StorageLocation> {
    await this.warehouses.getById(warehouseId);
    return this.save(
      this.locations.create({
        warehouseId,
        code: normalizeCode(dto.code),
        description: dto.description ?? null,
      }),
    );
  }

  async update(
    warehouseId: string,
    id: string,
    dto: UpdateLocationDto,
  ): Promise<StorageLocation> {
    const location = await this.getById(warehouseId, id);
    if (dto.code !== undefined) location.code = normalizeCode(dto.code);
    if (dto.description !== undefined) location.description = dto.description;
    return this.save(location);
  }

  async remove(warehouseId: string, id: string): Promise<void> {
    await this.locations.remove(await this.getById(warehouseId, id));
  }

  /** The unique constraint on (warehouse_id, code) is the source of truth. */
  private async save(location: StorageLocation): Promise<StorageLocation> {
    try {
      return await this.locations.save(location);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          error: 'LOCATION_CODE_TAKEN',
          message: `This warehouse already has a location with code ${location.code}`,
        });
      }
      throw error;
    }
  }
}
