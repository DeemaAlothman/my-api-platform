import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('health')
  health() {
    return { service: 'auth', status: 'ok', timestamp: new Date().toISOString() };
  }

  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    const data = await this.auth.login(body.username, body.password);
    return { success: true, data, meta: { timestamp: new Date().toISOString() } };
  }

  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    const data = await this.auth.refresh(body.refreshToken);
    return { success: true, data, meta: { timestamp: new Date().toISOString() } };
  }

  @Post('logout')
  async logout(@Req() req: Request) {
    const authHeader = req.headers['authorization'] || '';
    const data = await this.auth.logout(String(authHeader));
    return { success: true, data, meta: { timestamp: new Date().toISOString() } };
  }
}
