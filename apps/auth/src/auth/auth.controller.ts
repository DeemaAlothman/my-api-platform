import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

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
  async login(@Body() dto: LoginDto) {
    const data = await this.auth.login(dto.username, dto.password);
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
    const data = await this.auth.logout(String(authHeader));
    return { success: true, data, meta: { timestamp: new Date().toISOString() } };
  }
}
