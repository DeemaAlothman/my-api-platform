import {
  Controller, Get, Post, Put, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import {
  CreateAppointmentDto, UpdateAppointmentDto, UpdateStatusDto,
  RescheduleDto, ListAppointmentsQueryDto, CalendarQueryDto, SlotsQueryDto,
  PractitionerPatientsQueryDto, MyAppointmentsQueryDto,
} from './dto/appointment.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared/guards/permissions.guard';
import { Permission } from '@shared/decorators/permission.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';
import { User } from '@shared/auth/decorators/current-user.decorator';

@Controller('appointments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Post()
  @Permission(PERMISSIONS.CLINIC_APPOINTMENTS.CREATE)
  create(@Body() dto: CreateAppointmentDto, @User() user: any) {
    return this.service.create(dto, user.userId);
  }

  @Get()
  @Permission(PERMISSIONS.CLINIC_APPOINTMENTS.VIEW)
  findAll(@Query() query: ListAppointmentsQueryDto) {
    return this.service.findAll(query);
  }

  @Get('calendar')
  @Permission(PERMISSIONS.CLINIC_APPOINTMENTS.VIEW)
  getCalendar(@Query() query: CalendarQueryDto) {
    return this.service.getCalendar(query);
  }

  @Get('practitioner-patients')
  @Permission(PERMISSIONS.CLINIC_APPOINTMENTS.VIEW)
  getPractitionerPatients(@Query() query: PractitionerPatientsQueryDto, @User() user: any) {
    const canViewAll = (user.permissions as string[] ?? []).includes(
      PERMISSIONS.CLINIC_APPOINTMENTS.VIEW_ALL_PATIENTS,
    );
    const practitionerId = canViewAll
      ? (query.practitionerId ?? user.userId)
      : user.userId;
    return this.service.findPatientsByPractitioner(practitionerId, canViewAll);
  }

  @Get('practitioner/:id/slots')
  @Permission(PERMISSIONS.CLINIC_APPOINTMENTS.VIEW)
  getSlots(@Param('id') id: string, @Query() query: SlotsQueryDto) {
    return this.service.getAvailableSlots(id, query);
  }

  @Get('my-appointments')
  @Permission(PERMISSIONS.CLINIC_APPOINTMENTS.VIEW)
  getMyAppointments(@Query() query: MyAppointmentsQueryDto, @User() user: any) {
    return this.service.findMyAppointments(user.userId, query);
  }

  @Get(':id')
  @Permission(PERMISSIONS.CLINIC_APPOINTMENTS.VIEW)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Permission(PERMISSIONS.CLINIC_APPOINTMENTS.CREATE)
  update(@Param('id') id: string, @Body() dto: UpdateAppointmentDto, @User() user: any) {
    return this.service.update(id, dto, user.userId);
  }

  @Put(':id/cancel')
  @Permission(PERMISSIONS.CLINIC_APPOINTMENTS.CANCEL)
  cancel(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.service.cancel(id, reason);
  }

  @Put(':id/reschedule')
  @Permission(PERMISSIONS.CLINIC_APPOINTMENTS.CREATE)
  reschedule(@Param('id') id: string, @Body() dto: RescheduleDto) {
    return this.service.reschedule(id, dto);
  }

  @Put(':id/status')
  @Permission(PERMISSIONS.CLINIC_APPOINTMENTS.CREATE)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.service.updateStatus(id, dto);
  }
}
