import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { EmergencyService } from './emergency.service';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { User } from '@shared/auth';

@Controller('physio/emergency')
export class EmergencyController {
  constructor(private readonly emergency: EmergencyService) {}

  // إرسال تنبيه طارئ — يحتاج صلاحية physio:emergency-alert
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('physio:emergency-alert')
  @Post()
  sendAlert(@User() user: any) {
    return this.emergency.sendAlert(user.userId);
  }

  // الموظف الثابت يرد بملاحظة
  @UseGuards(JwtAuthGuard)
  @Post(':id/respond')
  respond(
    @Param('id') id: string,
    @User() user: any,
    @Body('note') note: string,
  ) {
    return this.emergency.respond(id, user.userId, note);
  }

  // التنبيهات الواصلة للموظف الثابت
  @UseGuards(JwtAuthGuard)
  @Get('incoming')
  listIncoming(@User() user: any) {
    return this.emergency.listForFixed(user.userId);
  }

  // تنبيهاتي التي أرسلتها
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('physio:emergency-alert')
  @Get('my')
  myAlerts(@User() user: any) {
    return this.emergency.myAlerts(user.userId);
  }
}
