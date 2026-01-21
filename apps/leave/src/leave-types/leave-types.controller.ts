import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  LeaveTypesService,
  CreateLeaveTypeDto,
  UpdateLeaveTypeDto,
} from './leave-types.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';

@Controller('leave-types')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LeaveTypesController {
  constructor(private readonly leaveTypesService: LeaveTypesService) {}

  // إنشاء نوع إجازة جديد (HR فقط)
  @Post()
  @Permission('leave_types:create')
  create(@Body() createDto: CreateLeaveTypeDto) {
    return this.leaveTypesService.create(createDto);
  }

  // تحديث نوع إجازة (HR فقط)
  @Put(':id')
  @Permission('leave_types:update')
  update(@Param('id') id: string, @Body() updateDto: UpdateLeaveTypeDto) {
    return this.leaveTypesService.update(id, updateDto);
  }

  // الحصول على جميع أنواع الإجازات
  @Get()
  @Permission('leave_types:read')
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.leaveTypesService.findAll(includeInactive === 'true');
  }

  // الحصول على نوع إجازة واحد
  @Get(':id')
  @Permission('leave_types:read')
  findOne(@Param('id') id: string) {
    return this.leaveTypesService.findOne(id);
  }

  // الحصول على نوع إجازة بالكود
  @Get('code/:code')
  @Permission('leave_types:read')
  findByCode(@Param('code') code: string) {
    return this.leaveTypesService.findByCode(code);
  }

  // تفعيل/تعطيل نوع إجازة (HR فقط)
  @Post(':id/toggle-active')
  @Permission('leave_types:update')
  toggleActive(@Param('id') id: string) {
    return this.leaveTypesService.toggleActive(id);
  }

  // حذف نوع إجازة (HR فقط)
  @Delete(':id')
  @Permission('leave_types:delete')
  remove(@Param('id') id: string) {
    return this.leaveTypesService.remove(id);
  }
}
