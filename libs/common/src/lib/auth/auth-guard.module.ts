import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';

export const ACCESS_TOKEN_ALGORITHM = 'HS256';

export interface AuthGuardModuleOptions {
  /** Secret the access tokens are signed with (JWT_ACCESS_SECRET). */
  accessSecret: string;
}

/**
 * Secures a whole service in one import. Every route then requires a valid
 * access token unless marked `@Public()`, and `@RequirePermissions(...)` is
 * enforced. Guards run in order: authenticate first, then authorise.
 *
 * Also exports a `JwtService` bound to the access secret, which auth-service
 * uses to sign tokens.
 */
@Global()
@Module({})
export class AuthGuardModule {
  static forRoot(options: AuthGuardModuleOptions): DynamicModule {
    return {
      module: AuthGuardModule,
      imports: [
        JwtModule.register({
          secret: options.accessSecret,
          signOptions: { algorithm: ACCESS_TOKEN_ALGORITHM },
          verifyOptions: { algorithms: [ACCESS_TOKEN_ALGORITHM] },
        }),
      ],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
      exports: [JwtModule],
    };
  }
}
