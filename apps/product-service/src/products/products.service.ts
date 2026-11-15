import { Paginated, paginate, toSkip } from '@ims/common';
import { isUniqueViolation } from '@ims/database';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import {
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from './dto/product.dto';
import { Product } from './product.entity';

export const normalizeSku = (sku: string) => sku.trim().toUpperCase();

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    private readonly categories: CategoriesService,
  ) {}

  async list(query: ProductQueryDto): Promise<Paginated<Product>> {
    const qb = this.products
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category');

    if (query.search) {
      qb.andWhere('(product.sku ILIKE :term OR product.name ILIKE :term)', {
        term: `%${query.search}%`,
      });
    }
    if (query.categoryId) {
      qb.andWhere('product.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.minPrice !== undefined) {
      qb.andWhere('product.price >= :minPrice', { minPrice: query.minPrice });
    }
    if (query.maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice: query.maxPrice });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('product.isActive = :isActive', { isActive: query.isActive });
    }
    if (query.attributes) {
      // JSONB containment, served by the GIN index on products.attributes.
      qb.andWhere('product.attributes @> CAST(:attributes AS jsonb)', {
        attributes: JSON.stringify(query.attributes),
      });
    }

    const [rows, total] = await qb
      // sortBy is validated against an enum, so it is safe to interpolate.
      .orderBy(
        `product.${query.sortBy}`,
        query.sortOrder === 'desc' ? 'DESC' : 'ASC',
      )
      .addOrderBy('product.id', 'ASC') // stable order across pages
      .skip(toSkip(query))
      .take(query.limit)
      .getManyAndCount();

    return paginate(rows, total, query);
  }

  async getById(id: string): Promise<Product> {
    const product = await this.products.findOne({
      where: { id },
      relations: { category: true },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const categoryId = dto.categoryId ?? null;
    await this.assertCategoryExists(categoryId);

    const saved = await this.save(
      this.products.create({
        sku: normalizeSku(dto.sku),
        name: dto.name.trim(),
        description: dto.description ?? null,
        price: dto.price,
        unit: dto.unit,
        attributes: dto.attributes ?? {},
        categoryId,
        isActive: true,
      }),
    );
    return this.getById(saved.id);
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    // Loaded without the relation so that changing categoryId is unambiguous.
    const product = await this.products.findOne({ where: { id } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);

    if (dto.categoryId !== undefined) {
      await this.assertCategoryExists(dto.categoryId);
      product.categoryId = dto.categoryId;
    }
    if (dto.sku !== undefined) product.sku = normalizeSku(dto.sku);
    if (dto.name !== undefined) product.name = dto.name.trim();
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.price !== undefined) product.price = dto.price;
    if (dto.unit !== undefined) product.unit = dto.unit;
    if (dto.attributes !== undefined) product.attributes = dto.attributes;
    if (dto.isActive !== undefined) product.isActive = dto.isActive;

    await this.save(product);
    return this.getById(id);
  }

  /**
   * Products are archived, never deleted: inventory and orders in other
   * services refer to product IDs, and those references must stay resolvable.
   */
  async archive(id: string): Promise<void> {
    const result = await this.products.update({ id }, { isActive: false });
    if (!result.affected)
      throw new NotFoundException(`Product ${id} not found`);
  }

  private async assertCategoryExists(categoryId: string | null): Promise<void> {
    if (categoryId === null) return;
    if (await this.categories.findById(categoryId)) return;
    throw new BadRequestException({
      error: 'CATEGORY_NOT_FOUND',
      message: `Category ${categoryId} does not exist`,
    });
  }

  /** The unique constraint on sku is the single source of truth. */
  private async save(product: Product): Promise<Product> {
    try {
      return await this.products.save(product);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          error: 'SKU_ALREADY_EXISTS',
          message: `A product with SKU ${product.sku} already exists`,
        });
      }
      throw error;
    }
  }
}
