import { Controller, Get, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboard(@Req() req: Request, @Res() res: Response) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing token', details: [] } });
    }

    const { userId } = this.dashboardService.decodeJwt(token);
    if (!userId) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token', details: [] } });
    }

    const data = await this.dashboardService.getDashboard(token);
    return res.json({ success: true, data });
  }
}
