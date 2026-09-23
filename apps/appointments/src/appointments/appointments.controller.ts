import {
  Controller, Get, Post, Put, Patch, Body, Param, Query, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AppointmentsService } from './appointments.service';
import {
  CreateAppointmentDto, UpdateAppointmentDto, UpdateStatusDto,
  RescheduleDto, ListAppointmentsQueryDto, CalendarQueryDto, SlotsQueryDto,
  PractitionerPatientsQueryDto, MyAppointmentsQueryDto, StatisticsQueryDto,
} from './dto/appointment.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared/guards/permissions.guard';
import { Permission } from '@shared/decorators/permission.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { InternalAuthGuard } from '@shared';

@Controller('appointments/internal')
export class AppointmentsInternalController {
  constructor(private readonly service: AppointmentsService) {}

  @Post('link-by-name')
  @UseGuards(InternalAuthGuard)
  linkByName(@Body() body: { patientId: string; firstName: string; lastName: string }) {
    return this.service.linkByName(body.patientId, body.firstName, body.lastName);
  }

  @Get('patient/:patientId')
  @UseGuards(InternalAuthGuard)
  getPatientAppointments(@Param('patientId') patientId: string) {
    return this.service.getPatientAppointmentsInternal(patientId);
  }
}

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

  @Get('statistics')
  @Permission(PERMISSIONS.CLINIC_APPOINTMENTS.STATISTICS_VIEW)
  getStatistics(@Query() query: StatisticsQueryDto) {
    return this.service.getStatistics(query);
  }

  @Get('statistics/export-xlsx')
  @Permission(PERMISSIONS.CLINIC_APPOINTMENTS.STATISTICS_VIEW)
  exportStatisticsXlsx(@Query() query: StatisticsQueryDto, @Res() res: Response) {
    return this.service.exportStatisticsXlsx(query, res);
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
  @Permission(PERMISSIONS.CLINIC_APPOINTMENTS.VIEW_OWN, PERMISSIONS.CLINIC_APPOINTMENTS.VIEW)
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
  cancel(@Param('id') id: string, @Body('reason') reason: string | undefined, @User() user: any) {
    return this.service.cancel(id, reason, user.userId);
  }

  @Put(':id/reschedule')
  @Permission(PERMISSIONS.CLINIC_APPOINTMENTS.CREATE)
  reschedule(@Param('id') id: string, @Body() dto: RescheduleDto) {
    return this.service.reschedule(id, dto);
  }

  @Put(':id/status')
  @Permission(PERMISSIONS.CLINIC_APPOINTMENTS.CREATE)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto, @User() user: any) {
    return this.service.updateStatus(id, dto, user.userId);
  }

  @Patch(':id/link-patient')
  @Permission(PERMISSIONS.CLINIC_APPOINTMENTS.CREATE)
  linkPatient(@Param('id') id: string, @Body('patientId') patientId: string) {
    return this.service.linkPatient(id, patientId);
  }
}
