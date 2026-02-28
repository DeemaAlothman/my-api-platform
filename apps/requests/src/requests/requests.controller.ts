import { Controller, Get, Post, Query, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
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

  // طلب واحد
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('requests:read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.requests.findOne(id);
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

  // موافقة المدير
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
}
