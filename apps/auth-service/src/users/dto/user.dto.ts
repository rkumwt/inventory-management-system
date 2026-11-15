import { Role } from '@ims/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { User } from '../user.entity';

/** Public view of a user. Never includes the password hash. */
export class UserResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'admin@ims.local' })
  email!: string;

  @ApiProperty({ example: 'Ada Admin' })
  name!: string;

  @ApiProperty({ enum: Role })
  role!: Role;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;
}

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export class ChangeRoleDto {
  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role!: Role;
}
