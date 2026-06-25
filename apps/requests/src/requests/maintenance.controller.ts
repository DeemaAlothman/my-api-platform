import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { User } from '@shared/auth';
import { CreateMaintenanceDto, LogisticsDecisionDto, MaintenanceDecisionDto } from './dto/maintenance.dto';

@Controller('requests/maintenance')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  // أي موظف يقدّم طلب صيانة
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@User() user: any, @Body() dto: CreateMaintenanceDto) {
    return this.maintenance.create(dto, user.userId);
  }

  // مهام الصيانة المعيَّنة عليّ (الموظف المكلَّف)
  @UseGuards(JwtAuthGuard)
  @Get('my-tasks')
  myTasks(@User() user: any) {
    return this.maintenance.myTasks(user.userId);
  }

  // المدير المباشر: موافقة — الـ service يتحقق من canApprove بدون permission guard
  @UseGuards(JwtAuthGuard)
  @Post(':id/manager-approve')
  managerApprove(@User() user: any, @Param('id') id: string, @Body() dto: MaintenanceDecisionDto) {
    return this.maintenance.managerApprove(id, user.userId, true, dto?.notes);
  }

  // المدير المباشر: رفض
  @UseGuards(JwtAuthGuard)
  @Post(':id/manager-reject')
  managerReject(@User() user: any, @Param('id') id: string, @Body() dto: MaintenanceDecisionDto) {
    return this.maintenance.managerApprove(id, user.userId, false, dto?.notes);
  }

  // المسؤول اللوجستي: قرار + تعيين
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('requests:lo-approve')
  @Post(':id/logistics')
  logistics(@User() user: any, @Param('id') id: string, @Body() dto: LogisticsDecisionDto) {
    return this.maintenance.logisticsDecision(id, user.userId, dto);
  }

  // المدير التنفيذي: موافقة
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('requests:ceo-approve')
  @Post(':id/executive-approve')
  executiveApprove(@User() user: any, @Param('id') id: string, @Body() dto: MaintenanceDecisionDto) {
    return this.maintenance.executiveApprove(id, user.userId, true, dto?.notes);
  }

  // المدير التنفيذي: رفض
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('requests:ceo-approve')
  @Post(':id/executive-reject')
  executiveReject(@User() user: any, @Param('id') id: string, @Body() dto: MaintenanceDecisionDto) {
    return this.maintenance.executiveApprove(id, user.userId, false, dto?.notes);
  }

  // الموظف المكلَّف: تم التنفيذ
  @UseGuards(JwtAuthGuard)
  @Post(':id/complete')
  complete(@User() user: any, @Param('id') id: string) {
    return this.maintenance.complete(id, user.userId);
  }
}
