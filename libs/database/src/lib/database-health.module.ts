import { Public } from '@ims/common';
import { Controller, Get, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  TerminusModule,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

@ApiTags('health')
@Public()
@Controller('health')
export class DatabaseHealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
  ) {}

  /** Readiness probe: 200 when the service can reach its database, else 503. */
  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.database.pingCheck('database', { timeout: 1500 }),
    ]);
  }
}

/** `GET /health` for any service that owns a database. */
@Module({
  imports: [TerminusModule],
  controllers: [DatabaseHealthController],
})
export class DatabaseHealthModule {}
