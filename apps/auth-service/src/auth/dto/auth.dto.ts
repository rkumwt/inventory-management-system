import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserResponse } from '../../users/dto/user.dto';

export class RegisterDto {
  @ApiProperty({ example: 'new.user@ims.local' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'New User' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'admin@ims.local' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class AuthTokensResponse {
  @ApiProperty({ description: 'JWT, sent as `Authorization: Bearer <token>`' })
  accessToken!: string;

  @ApiProperty({ description: 'Single-use; exchange it at POST /auth/refresh' })
  refreshToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({
    description: 'Access token lifetime in seconds',
    example: 900,
  })
  expiresIn!: number;

  @ApiProperty({ type: UserResponse })
  user!: UserResponse;
}
