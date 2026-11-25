import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '@shared/auth';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly service: AuditLogsService) {}

  @Get('resources')
  @ApiOperation({ summary: 'قائمة كل أنواع الموارد الموجودة فعلياً في سجل العمليات (لتعبئة فلتر المورد)' })
  async getResources() {
    return this.service.getDistinctResources();
  }

  @Get('statuses')
  @ApiOperation({ summary: 'الحالات الموجودة فعلاً في سجل العمليات (لتعبئة فلتر الحالة) — مقيَّدة بمورد إن مُرِّر' })
  @ApiQuery({ name: 'resource', required: false, description: 'المورد: appointments, requests...' })
  async getStatuses(@Query('resource') resource?: string) {
    return this.service.getStatuses(resource);
  }

  @Get()
  @ApiOperation({ summary: 'سجل العمليات — المدير يرى سجلاته وموظفيه، الموظف يرى سجله فقط' })
  @ApiQuery({ name: 'from', required: false, description: 'تاريخ البداية ISO 8601' })
  @ApiQuery({ name: 'to', required: false, description: 'تاريخ النهاية ISO 8601' })
  @ApiQuery({ name: 'resource', required: false, description: 'المورد: employees, leave-requests...' })
  @ApiQuery({ name: 'method', required: false, description: 'طريقة HTTP: GET, POST, PATCH, PUT, DELETE' })
  @ApiQuery({ name: 'userId', required: false, description: 'سجلات مستخدم معيّن' })
  @ApiQuery({ name: 'userSearch', required: false, description: 'بحث جزئي بلا حساسية لحالة الأحرف في اسم المستخدم أو اسمه العربي' })
  @ApiQuery({ name: 'patientId', required: false, description: 'كل العمليات على مريض — بالمعرّف المستهدف أو في تفاصيل العملية' })
  @ApiQuery({ name: 'targetSearch', required: false, description: 'بحث جزئي في اسم السجل المستهدف' })
  @ApiQuery({ name: 'actionType', required: false, description: 'CREATE | UPDATE | DELETE | LOGIN | LOGOUT' })
  @ApiQuery({ name: 'status', required: false, description: 'يطابق الحالة في تفاصيل العملية' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getLogs(
    @Req() req: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('resource') resource?: string,
    @Query('method') method?: string,
    @Query('userId') userId?: string,
    @Query('userSearch') userSearch?: string,
    @Query('patientId') patientId?: string,
    @Query('targetSearch') targetSearch?: string,
    @Query('actionType') actionType?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const user = (req as any).user;
    return this.service.getLogs(user.userId, user.permissions ?? [], {
      from,
      to,
      resource,
      method,
      userId,
      userSearch,
      patientId,
      targetSearch,
      actionType,
      status,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }
}
