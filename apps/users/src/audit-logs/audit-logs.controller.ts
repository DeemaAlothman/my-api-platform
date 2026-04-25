import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly service: AuditLogsService) {}

  @Get()
  @ApiOperation({
    summary: 'سجل العمليات — المدير يرى سجلاته وموظفيه، الموظف يرى سجله فقط',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'تاريخ البداية ISO 8601',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'تاريخ النهاية ISO 8601',
  })
  @ApiQuery({
    name: 'resource',
    required: false,
    description: 'المورد: employees, leave-requests...',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getLogs(
    @Req() req: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('resource') resource?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const user = (req as any).user;
    return this.service.getLogs(user.userId, user.permissions ?? [], {
      from,
      to,
      resource,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }
}
