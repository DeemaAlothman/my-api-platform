import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { EmployeeMappingService } from './employee-mapping.service';
import { CreateMappingDto, BulkCreateMappingDto } from './dto/create-mapping.dto';
import { UpdateMappingDto } from './dto/update-mapping.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';

@Controller('employee-fingerprints')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeeMappingController {
  constructor(private readonly employeeMappingService: EmployeeMappingService) {}

  @Post()
  @Permission('biometric.mappings.create')
  create(@Body() dto: CreateMappingDto) {
    return this.employeeMappingService.create(dto);
  }

  @Post('bulk')
  @Permission('biometric.mappings.create')
  bulkCreate(@Body() dto: BulkCreateMappingDto) {
    return this.employeeMappingService.bulkCreate(dto.mappings);
  }

  @Get()
  @Permission('biometric.mappings.read')
  findAll() {
    return this.employeeMappingService.findAll();
  }

  @Get('by-employee/:employeeId')
  @Permission('biometric.mappings.read')
  findByEmployee(@Param('employeeId') employeeId: string) {
    return this.employeeMappingService.findByEmployee(employeeId);
  }

  @Get(':id')
  @Permission('biometric.mappings.read')
  findOne(@Param('id') id: string) {
    return this.employeeMappingService.findOne(id);
  }

  @Patch(':id')
  @Permission('biometric.mappings.update')
  update(@Param('id') id: string, @Body() dto: UpdateMappingDto) {
    return this.employeeMappingService.update(id, dto);
  }

  @Delete(':id')
  @Permission('biometric.mappings.delete')
  remove(@Param('id') id: string) {
    return this.employeeMappingService.remove(id);
  }
}
