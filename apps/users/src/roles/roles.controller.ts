import { Controller, Get, Post, Put, Patch, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) { }

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
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roles.update(id, dto);
  }

  @Throttle({ hour: { limit: 20, ttl: 3600000 } })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('roles:update')
  @Put(':id/permissions')
  updatePermissions(@Param('id') id: string, @Body() dto: UpdateRolePermissionsDto) {
    return this.roles.updatePermissions(id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('roles:delete')
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.roles.remove(id);
  }
}

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly roles: RolesService) { }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('roles:read')
  @Get()
  list() {
    return this.roles.listPermissions();
  }
}
