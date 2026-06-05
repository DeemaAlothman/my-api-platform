import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAppointmentDto, UpdateAppointmentDto, UpdateStatusDto,
  RescheduleDto, ListAppointmentsQueryDto, CalendarQueryDto, SlotsQueryDto,
} from './dto/appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async checkLeaveOverlap(practitionerId: string, startTime: Date, endTime: Date): Promise<boolean> {
    const url = `${process.env.LEAVE_SERVICE_URL || 'http://leave:4003'}/api/v1/leave-requests/internal/check-overlap`;
    const token = process.env.INTERNAL_SERVICE_TOKEN || '';
    try {
      const params = new URLSearchParams({
        userId: practitionerId,
        from: startTime.toISOString(),
        to: endTime.toISOString(),
      });
      const res = await fetch(`${url}?${params}`, {
        headers: { 'x-internal-token': token },
      });
      // B13: فشل مغلق — إن لم نتمكن من التحقق من الإجازات، امنع الحجز بدل السماح بصمت
      if (!res.ok) {
        throw new BadRequestException('تعذّر التحقق من إجازات الموظف — لا يمكن إتمام الحجز حالياً');
      }
      const data = await res.json() as any;
      return data?.data?.hasOverlap ?? false;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('تعذّر الاتصال بخدمة الإجازات — لا يمكن إتمام الحجز حالياً');
    }
  }

  private async checkConflict(practitionerId: string, startTime: Date, endTime: Date, excludeId?: string) {
    const where: any = {
      practitionerId,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      AND: [
        { startTime: { lt: endTime } },
        { endTime: { gt: startTime } },
      ],
    };
    if (excludeId) where.id = { not: excludeId };
    return this.prisma.appointment.findFirst({ where });
  }

  async create(dto: CreateAppointmentDto, userId: string) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    if (endTime <= startTime) throw new BadRequestException('endTime must be after startTime');

    const conflict = await this.checkConflict(dto.practitionerId, startTime, endTime);
    if (conflict) throw new BadRequestException('Practitioner has a conflicting appointment at this time');

    const onLeave = await this.checkLeaveOverlap(dto.practitionerId, startTime, endTime);
    if (onLeave) throw new BadRequestException('Practitioner is on approved leave during this time');

    return this.prisma.appointment.create({
      data: {
        patientId: dto.patientId,
        caseId: dto.caseId,
        caseType: dto.caseType as any,
        practitionerId: dto.practitionerId,
        practitionerRole: dto.practitionerRole,
        appointmentType: dto.appointmentType as any,
        startTime,
        endTime,
        durationMinutes: dto.durationMinutes ?? 60,
        notes: dto.notes,
        createdBy: userId,
      },
    });
  }

  async findAll(query: ListAppointmentsQueryDto) {
    const { page = 1, limit = 50, patientId, practitionerId, status, date } = query;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (patientId) where.patientId = patientId;
    if (practitionerId) where.practitionerId = practitionerId;
    if (status) where.status = status;
    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.startTime = { gte: d, lt: next };
    }

    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({ where, skip, take: limit, orderBy: { startTime: 'asc' } }),
      this.prisma.appointment.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getCalendar(query: CalendarQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    const where: any = {
      startTime: { gte: from },
      endTime: { lte: to },
      status: { notIn: ['CANCELLED'] },
    };
    if (query.practitionerId) where.practitionerId = query.practitionerId;
    return this.prisma.appointment.findMany({ where, orderBy: { startTime: 'asc' } });
  }

  async getAvailableSlots(practitionerId: string, query: SlotsQueryDto) {
    const date = new Date(query.date);
    const slotDuration = query.slotDurationMinutes ?? 60;
    const dayStart = new Date(date);
    dayStart.setHours(8, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(17, 0, 0, 0);

    const booked = await this.prisma.appointment.findMany({
      where: {
        practitionerId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        startTime: { gte: dayStart, lt: dayEnd },
      },
      select: { startTime: true, endTime: true },
    });

    const slots: { startTime: string; endTime: string; available: boolean }[] = [];
    let cursor = new Date(dayStart);
    while (cursor < dayEnd) {
      const slotEnd = new Date(cursor.getTime() + slotDuration * 60000);
      const isBooked = booked.some(b => b.startTime < slotEnd && b.endTime > cursor);
      slots.push({
        startTime: cursor.toISOString(),
        endTime: slotEnd.toISOString(),
        available: !isBooked,
      });
      cursor = slotEnd;
    }
    return slots;
  }

  async findOne(id: string) {
    const a = await this.prisma.appointment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Appointment not found');
    return a;
  }

  async update(id: string, dto: UpdateAppointmentDto, userId: string) {
    await this.findOne(id);
    const data: any = {};
    if (dto.startTime && dto.endTime) {
      const startTime = new Date(dto.startTime);
      const endTime = new Date(dto.endTime);
      const conflict = await this.checkConflict(
        (await this.findOne(id)).practitionerId, startTime, endTime, id
      );
      if (conflict) throw new BadRequestException('Conflicting appointment exists');
      data.startTime = startTime;
      data.endTime = endTime;
    } else if (dto.startTime) {
      data.startTime = new Date(dto.startTime);
    } else if (dto.endTime) {
      data.endTime = new Date(dto.endTime);
    }
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.appointmentType) data.appointmentType = dto.appointmentType as any;
    return this.prisma.appointment.update({ where: { id }, data });
  }

  async cancel(id: string, reason?: string) {
    await this.findOne(id);
    return this.prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' as any, cancelledReason: reason },
    });
  }

  async reschedule(id: string, dto: RescheduleDto) {
    const appt = await this.findOne(id);
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    const conflict = await this.checkConflict(appt.practitionerId, startTime, endTime, id);
    if (conflict) throw new BadRequestException('Conflicting appointment exists');
    return this.prisma.appointment.update({
      where: { id },
      data: { startTime, endTime, status: 'RESCHEDULED' as any, notes: dto.notes },
    });
  }

  async updateStatus(id: string, dto: UpdateStatusDto) {
    await this.findOne(id);
    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: dto.status as any,
        cancelledReason: dto.cancelledReason,
      },
    });
  }
}
