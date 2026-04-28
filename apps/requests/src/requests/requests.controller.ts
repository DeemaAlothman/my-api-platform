import {
  Controller, Get, Post, Query, Param, Body, UseGuards,
  HttpCode, HttpStatus, UploadedFile, UseInterceptors, Res, StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { RequestsService } from './requests.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateRequestDto } from './dto/create-request.dto';
import { ApproveRequestDto } from './dto/approve-request.dto';
import { RejectRequestDto } from './dto/reject-request.dto';
import { CancelRequestDto } from './dto/cancel-request.dto';
import { ListRequestsQueryDto } from './dto/list-requests.query.dto';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  // قائمة كل الطلبات (HR / مدير)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('requests:read')
  @Get()
  list(@Query() query: ListRequestsQueryDto) {
    return this.requests.list(query);
  }

  // طلباتي أنا
  @UseGuards(JwtAuthGuard)
  @Get('my')
  myRequests(@CurrentUser() user: any, @Query() query: ListRequestsQueryDto) {
    return this.requests.myRequests(user.userId, query);
  }

  // الطلبات التي تنتظر موافقتي (يجب أن يكون قبل :id)
  @UseGuards(JwtAuthGuard)
  @Get('pending-my-approval')
  pendingMyApproval(
    @CurrentUser() user: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.requests.getPendingMyApproval(user.userId, Number(page) || 1, Number(limit) || 10);
  }

  // طلب واحد
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.requests.findOneScoped(id, user.userId, user.permissions ?? []);
  }

  // عرض خطوات الموافقة
  @UseGuards(JwtAuthGuard)
  @Get(':id/approvals')
  getApprovalSteps(@Param('id') id: string) {
    return this.requests.getApprovalSteps(id);
  }

  // إنشاء طلب
  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateRequestDto, @CurrentUser() user: any) {
    return this.requests.create(dto, user.userId);
  }

  // تقديم الطلب للمدير
  @UseGuards(JwtAuthGuard)
  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: any) {
    return this.requests.submit(id, user.userId);
  }

  // إلغاء الطلب
  @UseGuards(JwtAuthGuard)
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: CancelRequestDto) {
    return this.requests.cancel(id, user.userId, dto);
  }

  // تقديم استمارة مقابلة الخروج (طلبات الاستقالة فقط)
  @UseGuards(JwtAuthGuard)
  @Post(':id/exit-interview')
  submitExitInterview(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: Record<string, any>,
  ) {
    return this.requests.submitExitInterview(id, user.userId, body);
  }

  // موافقة ديناميكية (النظام الجديد)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('requests:approve')
  @Post(':id/approve')
  approveStep(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: ApproveRequestDto) {
    return this.requests.approveStep(id, user.userId, dto);
  }

  // رفض ديناميكي (النظام الجديد)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('requests:reject')
  @Post(':id/reject')
  rejectStep(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: RejectRequestDto) {
    return this.requests.rejectStep(id, user.userId, dto);
  }

  // موافقة المدير (deprecated)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('requests:manager-approve')
  @Post(':id/manager-approve')
  managerApprove(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: ApproveRequestDto) {
    return this.requests.managerApprove(id, user.userId, dto);
  }

  // رفض المدير
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('requests:manager-reject')
  @Post(':id/manager-reject')
  managerReject(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: RejectRequestDto) {
    return this.requests.managerReject(id, user.userId, dto);
  }

  // موافقة HR
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('requests:hr-approve')
  @Post(':id/hr-approve')
  hrApprove(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: ApproveRequestDto) {
    return this.requests.hrApprove(id, user.userId, dto);
  }

  // رفض HR
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('requests:hr-reject')
  @Post(':id/hr-reject')
  hrReject(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: RejectRequestDto) {
    return this.requests.hrReject(id, user.userId, dto);
  }

  // B.7: Upload hiring contract PDF
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('requests:hiring:complete')
  @Post(':id/hiring-pdf')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('contractPdf'))
  uploadHiringPdf(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    return this.requests.uploadHiringPdf(id, file, user.userId);
  }

  // B.7: Download hiring contract PDF
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('requests:read')
  @Get(':id/hiring-pdf')
  async downloadHiringPdf(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { filePath, requestNumber } = await this.requests.getHiringPdfPath(id);
    const buffer = fs.readFileSync(filePath);
    const fileName = `hiring-contract-${requestNumber}${path.extname(filePath) || '.pdf'}`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
      'Content-Length': String(buffer.length),
    });
    return new StreamableFile(buffer);
  }
}
