import { Controller, Get, Post, Put, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('roles:read')
  @Get()
  list() {
    return this.roles.list();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('roles:read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roles.findOne(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('roles:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateRoleDto) {
    return this.roles.create(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('roles:update')
  @Put(':id/permissions')
  updatePermissions(@Param('id') id: string, @Body() dto: UpdateRolePermissionsDto) {
    return this.roles.updatePermissions(id, dto);
  }
}

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly roles: RolesService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('roles:read')
  @Get()
  list() {
    return this.roles.listPermissions();
  }
}
