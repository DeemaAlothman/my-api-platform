import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { BaileysClientService } from './baileys-client.service';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WhatsappController {
  constructor(private readonly baileys: BaileysClientService) {}

  @Get('status')
  @Permission(PERMISSIONS.WHATSAPP.MANAGE)
  getStatus() {
    return this.baileys.getStatus();
  }

  // رمز QR لربط رقم واتساب جديد — فاضي (null) لو متصل أصلاً أو ما في رمز معلَّق هلّق
  @Get('qr')
  @Permission(PERMISSIONS.WHATSAPP.MANAGE)
  getQr() {
    return { qrDataUrl: this.baileys.getQrDataUrl() };
  }

  // فصل الرقم الحالي ومسح جلسته محلياً — بيحتاج مسح QR جديد بعدها. ما يلمس أي بيانات
  // بقاعدة البيانات (سجل الإرسال القديم يضل متل ما هو)
  @Post('logout')
  @Permission(PERMISSIONS.WHATSAPP.MANAGE)
  async logout() {
    await this.baileys.logout();
    return { success: true };
  }
}
