import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { WorkSchedulesService } from './work-schedules.service';
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';

@Controller('work-schedules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkSchedulesController {
  constructor(private readonly service: WorkSchedulesService) {}

  @Post()
  @Permission('attendance.work-schedules.create')
  create(@Body() dto: CreateWorkScheduleDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permission('attendance.work-schedules.read')
  findAll(@Query('isActive') isActive?: string) {
    const filters: any = {};
    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }
    return this.service.findAll(filters);
  }

  @Get(':id')
  @Permission('attendance.work-schedules.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permission('attendance.work-schedules.update')
  update(@Param('id') id: string, @Body() dto: UpdateWorkScheduleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permission('attendance.work-schedules.delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
