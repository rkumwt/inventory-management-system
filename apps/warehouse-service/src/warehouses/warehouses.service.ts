import { Paginated, paginate, toSkip } from '@ims/common';
import { isUniqueViolation } from '@ims/database';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  WarehouseQueryDto,
} from './dto/warehouse.dto';
import { Warehouse } from './warehouse.entity';

export const normalizeCode = (code: string) => code.trim().toUpperCase();

@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouses: Repository<Warehouse>,
  ) {}

  async list(query: WarehouseQueryDto): Promise<Paginated<Warehouse>> {
    const filter: FindOptionsWhere<Warehouse> =
      query.isActive === undefined ? {} : { isActive: query.isActive };
    const term = query.search ? ILike(`%${query.search}%`) : undefined;

    const [rows, total] = await this.warehouses.findAndCount({
      // An array means OR: the term may match the code, the name or the city.
      where: term
        ? [
            { ...filter, code: term },
            { ...filter, name: term },
            { ...filter, city: term },
          ]
        : filter,
      order: { name: 'ASC', id: 'ASC' },
      skip: toSkip(query),
      take: query.limit,
    });
    return paginate(rows, total, query);
  }

  findById(id: string): Promise<Warehouse | null> {
    return this.warehouses.findOne({ where: { id } });
  }

  async getById(id: string): Promise<Warehouse> {
    const warehouse = await this.findById(id);
    if (!warehouse) throw new NotFoundException(`Warehouse ${id} not found`);
    return warehouse;
  }

  create(dto: CreateWarehouseDto): Promise<Warehouse> {
    return this.save(
      this.warehouses.create({
        code: normalizeCode(dto.code),
        name: dto.name.trim(),
        address: dto.address ?? null,
        city: dto.city.trim(),
        country: dto.country.trim(),
        isActive: true,
      }),
    );
  }

  async update(id: string, dto: UpdateWarehouseDto): Promise<Warehouse> {
    const warehouse = await this.getById(id);
    if (dto.code !== undefined) warehouse.code = normalizeCode(dto.code);
    if (dto.name !== undefined) warehouse.name = dto.name.trim();
    if (dto.address !== undefined) warehouse.address = dto.address;
    if (dto.city !== undefined) warehouse.city = dto.city.trim();
    if (dto.country !== undefined) warehouse.country = dto.country.trim();
    if (dto.isActive !== undefined) warehouse.isActive = dto.isActive;
    return this.save(warehouse);
  }

  /**
   * Warehouses are archived, never deleted: stock and orders in other
   * services refer to warehouse IDs, and those references must stay
   * resolvable.
   */
  async archive(id: string): Promise<void> {
    const result = await this.warehouses.update({ id }, { isActive: false });
    if (!result.affected) {
      throw new NotFoundException(`Warehouse ${id} not found`);
    }
  }

  /** The unique constraint on code is the single source of truth. */
  private async save(warehouse: Warehouse): Promise<Warehouse> {
    try {
      return await this.warehouses.save(warehouse);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          error: 'WAREHOUSE_CODE_TAKEN',
          message: `A warehouse with code ${warehouse.code} already exists`,
        });
      }
      throw error;
    }
  }
}
