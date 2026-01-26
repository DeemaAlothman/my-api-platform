import { Controller, Get, Post, Patch, Delete, Query, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';
import { User } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/interfaces/user.interface';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ListEmployeesQueryDto } from './dto/list-employees.query.dto';
import { LinkUserDto } from './dto/link-user.dto';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('employees:read')
  @Get()
  list(@Query() query: ListEmployeesQueryDto) {
    return this.employees.list(query);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('employees:read')
  @Get('department/:departmentId')
  getByDepartment(@Param('departmentId') departmentId: string) {
    return this.employees.getByDepartment(departmentId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('employees:read')
  @Get('manager/:managerId/subordinates')
  getSubordinates(@Param('managerId') managerId: string) {
    return this.employees.getSubordinates(managerId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  getMyEmployee(@User() user: CurrentUser) {
    return this.employees.findByUsername(user.username);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('employees:read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employees.findOne(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('employees:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateEmployeeDto) {
    return this.employees.create(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('employees:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employees.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('employees:delete')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.employees.remove(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('employees:update')
  @Post(':id/link-user')
  linkUser(@Param('id') id: string, @Body() dto: LinkUserDto) {
    return this.employees.linkUser(id, dto);
  }
}
