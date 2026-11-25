import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard, User } from '@shared/auth';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @SkipThrottle()
  @Get('health')
  health() {
    return { service: 'auth', status: 'ok', timestamp: new Date().toISOString() };
  }

  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const data = await this.auth.login(dto.username, dto.password);
    // الهوية تُثبَت على الطلب بعد التحقق منها، فينسب معترضُ التدقيق السطرَ لصاحبه.
    // الدخول الفاشل يرمي قبل هذا السطر فيبقى بلا هوية — وهذا هو الصحيح: اسمٌ
    // لم يثبت أنه صاحب الحساب لا يُسجَّل كأنه فعل الدخول.
    (req as any).user = { userId: data.user.id, username: data.user.username };
    return { success: true, data, meta: { timestamp: new Date().toISOString() } };
  }

  @Throttle({ short: { limit: 3, ttl: 60000 } })
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    const data = await this.auth.refresh(dto.refreshToken);
    return { success: true, data, meta: { timestamp: new Date().toISOString() } };
  }

  @Post('logout')
  async logout(@Req() req: Request) {
    const authHeader = req.headers['authorization'] || '';
    const { actor, ...data } = await this.auth.logout(String(authHeader));
    // تُنزَع الهوية من الاستجابة وتُثبَت على الطلب: شكل الرد للواجهة كما كان،
    // ومعترضُ التدقيق يجد صاحبَ العملية
    if (actor) (req as any).user = actor;
    return { success: true, data, meta: { timestamp: new Date().toISOString() } };
  }

  // الصلاحيات/المسميات/التفويضات الفعّالة الآن — استعلام حي، مش من التوكن المخزَّن بالفرونت
  @UseGuards(JwtAuthGuard)
  @Get('me/effective')
  async getEffectiveProfile(@User() user: any) {
    const data = await this.auth.getEffectiveProfile(user.userId);
    return { success: true, data, meta: { timestamp: new Date().toISOString() } };
  }
}
