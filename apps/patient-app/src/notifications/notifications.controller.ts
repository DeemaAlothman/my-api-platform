import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { InternalAuthGuard } from '@shared';
import { PatientJwtAuthGuard } from '../patient-auth/guards/patient-jwt-auth.guard';
import { CurrentPatient } from '../patient-auth/decorators/current-patient.decorator';
import { NotificationsService } from './notifications.service';
import { RegisterDeviceDto, InternalNotifyDto } from './dto/notifications.dto';

@Controller('patient-app/me')
@UseGuards(PatientJwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Post('devices')
  registerDevice(@CurrentPatient() patient: { patientAccountId: string }, @Body() dto: RegisterDeviceDto) {
    return this.service.registerDevice(patient.patientAccountId, dto.token, dto.platform);
  }

  @Get('notifications')
  list(@CurrentPatient() patient: { patientAccountId: string }) {
    return this.service.listForPatient(patient.patientAccountId);
  }

  @Post('notifications/:id/read')
  markRead(@CurrentPatient() patient: { patientAccountId: string }, @Param('id') id: string) {
    return this.service.markRead(patient.patientAccountId, id);
  }
}

// نقطة داخلية (خدمة-لخدمة): إرسال إشعار لمريض عبر erpPatientId — تُستخدم من appointments عند حجز موعد جديد
@Controller('patient-app/internal')
export class NotificationsInternalController {
  constructor(private readonly service: NotificationsService) {}

  @Post('notify')
  @UseGuards(InternalAuthGuard)
  notify(@Body() dto: InternalNotifyDto) {
    return this.service.notifyByErpPatientId(
      dto.erpPatientId,
      dto.type as any,
      dto.titleAr,
      dto.titleEn,
      dto.bodyAr,
      dto.bodyEn,
    );
  }
}
