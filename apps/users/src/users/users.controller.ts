import { Controller, Get, Post, Patch, Delete, Query, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('health')
  health() {
    return this.users.health();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('users:read')
  @Get('users')
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('users:read')
  @Get('users/:id')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('users:create')
  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('users:update')
  @Patch('users/:id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('users:delete')
  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.users.remove(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('users:assign_roles')
  @Post('users/:id/roles')
  assignRoles(@Param('id') id: string, @Body() dto: any) {
    return this.users.assignRoles(id, dto);
  }

  // keep this for verifying guard behavior
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('users:read')
  @Get('users/_guard-test')
  guardTest() {
    return { ok: true };
  }
}
