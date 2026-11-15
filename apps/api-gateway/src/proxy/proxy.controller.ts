import { Public } from '@ims/common';
import { All, Controller, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { env } from '../config/env';
import { ProxyService } from './proxy.service';

/**
 * The only routes reachable without an access token. They get a much lower
 * rate limit than the rest of the API to slow down credential guessing.
 */
@ApiTags('auth')
@Controller('auth')
export class PublicAuthProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @Public()
  @Throttle({
    default: {
      limit: env.AUTH_RATE_LIMIT_MAX,
      ttl: env.RATE_LIMIT_WINDOW_SECONDS * 1000,
    },
  })
  @Post(['login', 'register', 'refresh', 'logout'])
  @ApiOperation({
    summary: 'Public auth routes, forwarded to auth-service',
    description:
      'POST /v1/auth/login | register | refresh | logout. See the auth-service docs for request and response bodies.',
  })
  forward(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxy.forward(req, res);
  }
}

/**
 * Everything else under /v1 requires a valid access token (global
 * JwtAuthGuard) and is forwarded to the owning service, which enforces
 * permissions itself.
 */
@Controller()
export class ProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  @ApiExcludeEndpoint()
  forward(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxy.forward(req, res);
  }
}
