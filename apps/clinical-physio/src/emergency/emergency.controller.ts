import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { EmergencyService } from './emergency.service';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { User } from '@shared/auth';

@Controller('physio/emergency')
export class EmergencyController {
  constructor(private readonly emergency: EmergencyService) {}

  // إرسال تنبيه طارئ — يحتاج صلاحية physio:emergency-alert — مرتبط دائماً بحالة مريض محددة
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('physio:emergency-alert')
  @Post()
  sendAlert(@User() user: any, @Body('caseId') caseId: string, @Body('note') note?: string) {
    return this.emergency.sendAlert(user.userId, caseId, note);
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

  // تنبيهات حالة محددة — يُستخدم من صفحة الحالة لعرض تنبيهاتها فقط
  @UseGuards(JwtAuthGuard)
  @Get('case/:caseId')
  alertsByCase(@Param('caseId') caseId: string) {
    return this.emergency.alertsByCase(caseId);
  }

  // تفاصيل تنبيه واحد (يُستخدم عند الضغط على الإشعار لاستخراج caseId)
  // ملاحظة: يجب أن يبقى هذا المسار بعد المسارات الحرفية (incoming/my/case) لتجنّب تعارض المطابقة
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.emergency.findOne(id);
  }
}
