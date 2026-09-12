import { IsEnum, IsString } from 'class-validator';

export class RegisterDeviceDto {
  @IsString() token: string;
  @IsEnum(['IOS', 'ANDROID', 'WEB']) platform: 'IOS' | 'ANDROID' | 'WEB';
}

// حمولة النداء الداخلي (خدمة-لخدمة) لإرسال إشعار لمريض — تستخدمها appointments عند حجز موعد جديد
export class InternalNotifyDto {
  @IsString() erpPatientId: string;
  @IsEnum(['DAILY_REMINDER', 'PROGRAM_ASSIGNED', 'PROGRAM_UPDATED', 'PROGRAM_CANCELLED', 'PROGRAM_REORDERED', 'APPOINTMENT_CREATED'])
  type: string;
  @IsString() titleAr: string;
  @IsString() titleEn: string;
  @IsString() bodyAr: string;
  @IsString() bodyEn: string;
}
