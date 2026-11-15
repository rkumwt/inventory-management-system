import type { AuthUser } from '@ims/common';
import {
  CurrentUser,
  Paginated,
  PaginationQueryDto,
  Permission,
  RequirePermissions,
} from '@ims/common';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChangeRoleDto, toUserResponse, UserResponse } from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@RequirePermissions(Permission.UsersManage)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users (admin only)' })
  async list(
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<UserResponse>> {
    const page = await this.users.list(query);
    return { ...page, data: page.data.map(toUserResponse) };
  }

  @Patch(':id/role')
  @ApiOperation({ summary: "Change a user's role (admin only)" })
  async changeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeRoleDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<UserResponse> {
    return toUserResponse(await this.users.changeRole(id, dto.role, actor.id));
  }
}
