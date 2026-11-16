import {
  Paginated,
  paginate,
  PaginationQueryDto,
  Role,
  toSkip,
} from '@ims/common';
import { isUniqueViolation } from '@ims/database';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { PasswordService } from './password.service';
import { User } from './user.entity';

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  role: Role;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly passwords: PasswordService,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: normalizeEmail(email) } });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  async getById(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  verifyPassword(user: User, password: string): Promise<boolean> {
    return this.passwords.verify(user.passwordHash, password);
  }

  async create(input: CreateUserInput): Promise<User> {
    const email = normalizeEmail(input.email);
    if (await this.findByEmail(email)) throw emailTaken();

    try {
      return await this.users.save(
        this.users.create({
          email,
          name: input.name.trim(),
          passwordHash: await this.passwords.hash(input.password),
          role: input.role,
          isActive: true,
        }),
      );
    } catch (error) {
      // Two concurrent registrations: the unique constraint is the real guard.
      if (isUniqueViolation(error)) throw emailTaken();
      throw error;
    }
  }

  async list(query: PaginationQueryDto): Promise<Paginated<User>> {
    const term = query.search ? ILike(`%${query.search}%`) : undefined;
    const [rows, total] = await this.users.findAndCount({
      where: term ? [{ email: term }, { name: term }] : {},
      order: { createdAt: 'DESC' },
      skip: toSkip(query),
      take: query.limit,
    });
    return paginate(rows, total, query);
  }

  async changeRole(id: string, role: Role, actorId: string): Promise<User> {
    if (id === actorId) {
      // Prevents the last admin from locking themselves out.
      throw new BadRequestException({
        error: 'CANNOT_CHANGE_OWN_ROLE',
        message: 'You cannot change your own role',
      });
    }
    const user = await this.getById(id);
    user.role = role;
    return this.users.save(user);
  }
}

function emailTaken(): ConflictException {
  return new ConflictException({
    error: 'EMAIL_ALREADY_REGISTERED',
    message: 'An account with this email already exists',
  });
}
