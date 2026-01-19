import { Controller, Get, Post, Patch, Delete, Query, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { ListDepartmentsQueryDto } from './dto/list-departments.query.dto';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('departments:read')
  @Get('tree')
  getTree() {
    return this.departments.getTree();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('departments:read')
  @Get()
  list(@Query() query: ListDepartmentsQueryDto) {
    return this.departments.list(query);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('departments:read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.departments.findOne(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('departments:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateDepartmentDto) {
    return this.departments.create(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('departments:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departments.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('departments:delete')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.departments.remove(id);
  }
}
