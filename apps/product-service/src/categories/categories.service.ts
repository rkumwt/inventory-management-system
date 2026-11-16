import { Paginated, paginate, PaginationQueryDto, toSkip } from '@ims/common';
import { isForeignKeyViolation, isUniqueViolation } from '@ims/database';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Category } from './category.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
  ) {}

  async list(query: PaginationQueryDto): Promise<Paginated<Category>> {
    const [rows, total] = await this.categories.findAndCount({
      where: query.search ? { name: ILike(`%${query.search}%`) } : {},
      order: { name: 'ASC' },
      skip: toSkip(query),
      take: query.limit,
    });
    return paginate(rows, total, query);
  }

  findById(id: string): Promise<Category | null> {
    return this.categories.findOne({ where: { id } });
  }

  async getById(id: string): Promise<Category> {
    const category = await this.findById(id);
    if (!category) throw new NotFoundException(`Category ${id} not found`);
    return category;
  }

  create(dto: CreateCategoryDto): Promise<Category> {
    return this.save(
      this.categories.create({
        name: dto.name.trim(),
        description: dto.description ?? null,
      }),
    );
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.getById(id);
    if (dto.name !== undefined) category.name = dto.name.trim();
    if (dto.description !== undefined) category.description = dto.description;
    return this.save(category);
  }

  async remove(id: string): Promise<void> {
    const category = await this.getById(id);
    try {
      await this.categories.remove(category);
    } catch (error) {
      // products.category_id is ON DELETE RESTRICT.
      if (isForeignKeyViolation(error)) {
        throw new ConflictException({
          error: 'CATEGORY_IN_USE',
          message: 'This category still has products; move them first',
        });
      }
      throw error;
    }
  }

  /** The unique index on lower(name) is the single source of truth. */
  private async save(category: Category): Promise<Category> {
    try {
      return await this.categories.save(category);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          error: 'CATEGORY_NAME_TAKEN',
          message: `A category named "${category.name}" already exists`,
        });
      }
      throw error;
    }
  }
}
