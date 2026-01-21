import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { ApproveLeaveRequestDto, RejectLeaveRequestDto } from './dto/approve-leave-request.dto';
import { CancelLeaveRequestDto } from './dto/cancel-leave-request.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';
import { EmployeeId, UserId } from '../common/decorators/employee.decorator';
import { EmployeeInterceptor } from '../common/interceptors/employee.interceptor';

@Controller('leave-requests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(EmployeeInterceptor)
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  // إنشاء طلب إجازة جديد (مسودة)
  @Post()
  @Permission('leave_requests:create')
  create(@Body() createDto: CreateLeaveRequestDto, @EmployeeId() employeeId: string) {
    return this.leaveRequestsService.create(createDto, employeeId);
  }

  // تحديث طلب إجازة (فقط DRAFT)
  @Put(':id')
  @Permission('leave_requests:update')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateLeaveRequestDto,
    @EmployeeId() employeeId: string,
  ) {
    return this.leaveRequestsService.update(id, updateDto, employeeId);
  }

  // تقديم طلب الإجازة (من DRAFT إلى PENDING_MANAGER)
  @Post(':id/submit')
  @Permission('leave_requests:submit')
  submit(@Param('id') id: string, @EmployeeId() employeeId: string) {
    return this.leaveRequestsService.submit(id, employeeId);
  }

  // موافقة المدير
  @Post(':id/approve-manager')
  @Permission('leave_requests:approve_manager')
  approveByManager(
    @Param('id') id: string,
    @Body() dto: ApproveLeaveRequestDto,
    @UserId() managerId: string,
  ) {
    return this.leaveRequestsService.approveByManager(id, dto, managerId);
  }

  // رفض المدير
  @Post(':id/reject-manager')
  @Permission('leave_requests:approve_manager')
  rejectByManager(
    @Param('id') id: string,
    @Body() dto: RejectLeaveRequestDto,
    @UserId() managerId: string,
  ) {
    return this.leaveRequestsService.rejectByManager(id, dto, managerId);
  }

  // موافقة HR
  @Post(':id/approve-hr')
  @Permission('leave_requests:approve_hr')
  approveByHR(
    @Param('id') id: string,
    @Body() dto: ApproveLeaveRequestDto,
    @UserId() hrUserId: string,
  ) {
    return this.leaveRequestsService.approveByHR(id, dto, hrUserId);
  }

  // رفض HR
  @Post(':id/reject-hr')
  @Permission('leave_requests:approve_hr')
  rejectByHR(
    @Param('id') id: string,
    @Body() dto: RejectLeaveRequestDto,
    @UserId() hrUserId: string,
  ) {
    return this.leaveRequestsService.rejectByHR(id, dto, hrUserId);
  }

  // إلغاء الطلب
  @Post(':id/cancel')
  @Permission('leave_requests:cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelLeaveRequestDto,
    @UserId() userId: string,
  ) {
    return this.leaveRequestsService.cancel(id, dto, userId);
  }

  // الحصول على طلب واحد
  @Get(':id')
  @Permission('leave_requests:read')
  findOne(@Param('id') id: string) {
    return this.leaveRequestsService.findOne(id);
  }

  // قائمة طلبات الموظف الحالي
  @Get('my/requests')
  @Permission('leave_requests:read')
  findMyRequests(@EmployeeId() employeeId: string, @Query() filters: any) {
    return this.leaveRequestsService.findByEmployee(employeeId, filters);
  }

  // قائمة جميع الطلبات (للمدراء و HR)
  @Get()
  @Permission('leave_requests:read_all')
  findAll(@Query() filters: any) {
    return this.leaveRequestsService.findAll(filters);
  }

  // حذف طلب (فقط DRAFT)
  @Delete(':id')
  @Permission('leave_requests:delete')
  remove(@Param('id') id: string, @EmployeeId() employeeId: string) {
    return this.leaveRequestsService.remove(id, employeeId);
  }
}
