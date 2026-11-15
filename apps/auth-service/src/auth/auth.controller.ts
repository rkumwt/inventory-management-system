import type { AuthUser } from '@ims/common';
import { CurrentUser, Public } from '@ims/common';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { toUserResponse, UserResponse } from '../users/dto/user.dto';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import {
  AuthTokensResponse,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Create an account (role: STAFF)' })
  async register(@Body() dto: RegisterDto): Promise<UserResponse> {
    return toUserResponse(await this.auth.register(dto));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange email + password for a token pair' })
  login(@Body() dto: LoginDto): Promise<AuthTokensResponse> {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token for a new token pair' })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensResponse> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a refresh token' })
  logout(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The currently authenticated user' })
  async me(@CurrentUser() user: AuthUser): Promise<UserResponse> {
    return toUserResponse(await this.users.getById(user.id));
  }
}
