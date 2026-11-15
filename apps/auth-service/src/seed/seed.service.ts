import { Role } from '@ims/common';
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { AUTH_ENV, AuthEnv } from '../config/env.schema';
import { UsersService } from '../users/users.service';

export const SEED_USERS = [
  { email: 'admin@ims.local', name: 'Ada Admin', role: Role.Admin },
  { email: 'manager@ims.local', name: 'Max Manager', role: Role.Manager },
  { email: 'staff@ims.local', name: 'Sam Staff', role: Role.Staff },
] as const;

/**
 * Creates one user per role when SEED_DATA=true so the app is usable right
 * after `pnpm dev`. Idempotent: existing users are left untouched.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly users: UsersService,
    @Inject(AUTH_ENV)
    private readonly config: Pick<AuthEnv, 'SEED_DATA' | 'SEED_USER_PASSWORD'>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const password = this.config.SEED_USER_PASSWORD;
    if (!this.config.SEED_DATA || !password) return;

    for (const seed of SEED_USERS) {
      if (await this.users.findByEmail(seed.email)) continue;
      await this.users.create({ ...seed, password });
      this.logger.log(`Seeded ${seed.role} user ${seed.email}`);
    }
  }
}
