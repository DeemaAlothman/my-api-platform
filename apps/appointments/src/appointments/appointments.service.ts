import {
  Injectable, NotFoundException, BadRequestException, OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAppointmentDto, UpdateAppointmentDto, UpdateStatusDto,
  RescheduleDto, ListAppointmentsQueryDto, CalendarQueryDto, SlotsQueryDto,
} from './dto/appointment.dto';

@Injectable()
export class AppointmentsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // فحص كل 15 دقيقة للمواعيد القادمة خلال ساعة
    setInterval(() => this.sendReminderNotifications().catch(() => {}), 15 * 60 * 1000);
  }

  // ── Notifications ───────────────────────────────────────────────────────────

  private async insertNotif(userId: string, data: object, titleAr: string, messageAr: string) {
    await this.prisma.$queryRawUnsafe(
      `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
       VALUES (gen_random_uuid()::text, $1, 'GENERAL'::"users"."NotificationType", $2, $2, $3, $3, $4::jsonb, NOW())`,
      userId, titleAr, messageAr, JSON.stringify(data),
    ).catch(() => {});
  }

  private async notifyPractitioner(appt: { id: string; practitionerId: string; physiotherapistId?: string | null; therapistIds?: string[]; patientId: string; startTime: Date }, titleAr: string, messageAr: string) {
    const targets = new Set<string>([appt.practitionerId]);
    if (appt.physiotherapistId) targets.add(appt.physiotherapistId);
    for (const tid of appt.therapistIds ?? []) targets.add(tid);
    const payload = { appointmentId: appt.id, patientId: appt.patientId };
    for (const userId of targets) {
      await this.insertNotif(userId, payload, titleAr, messageAr);
    }
  }

  private async sendReminderNotifications() {
    const now = new Date();
    const in60 = new Date(now.getTime() + 60 * 60 * 1000);
    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: { in: ['SCHEDULED', 'CONFIRMED'] as any[] },
        startTime: { gte: now, lte: in60 },
        reminderSentAt: null,
      },
    });
    for (const appt of appointments) {
      const timeStr = appt.startTime.toLocaleTimeString('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit' });
      await this.notifyPractitioner(
        appt as any,
        'تذكير بموعد قادم',
        `لديك موعد في الساعة ${timeStr}`,
      );
      await this.prisma.appointment.update({
        where: { id: appt.id },
        data: { reminderSentAt: new Date() },
      });
    }
  }

  private async getUserIdsByJobTitle(code: string): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
      `SELECT e."userId" FROM users.employees e
       JOIN users.job_titles jt ON jt.id = e."jobTitleId"
       WHERE jt.code = $1 AND e."deletedAt" IS NULL`,
      code,
    ).catch(() => [] as Array<{ userId: string }>);
    return rows.map(r => r.userId).filter(Boolean);
  }

  private async notifySupervisors(appt: { id: string; patientId: string }, msg: string) {
    const supervisorIds = await this.getUserIdsByJobTitle('VTX-JTL-000011');
    for (const userId of supervisorIds) {
      await this.insertNotif(userId, { appointmentId: appt.id }, 'إلغاء موعد', msg);
    }
  }

  private async getDeptManagerUserId(deptCode: string): Promise<string | null> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
      `SELECT e."userId" FROM users.departments d
       JOIN users.employees e ON e.id = d."managerId"
       WHERE d.code = $1 AND d."deletedAt" IS NULL
       LIMIT 1`,
      deptCode,
    ).catch(() => [] as Array<{ userId: string }>);
    return rows[0]?.userId ?? null;
  }

  private async notifyExaminationDeptHeads(appt: { id: string }, role: string, msg: string) {
    const isPhysio     = role === 'PHYSIOTHERAPIST';
    const isProsthetics = ['PROSTHETIST', 'PODIATRIST'].includes(role);

    const codes: string[] = [];
    if (isPhysio || isProsthetics) codes.push('VTX-DEP-000007', 'VTX-DEP-000016');
    if (isProsthetics)              codes.push('VTX-DEP-000015');

    const userIds = await Promise.all(codes.map(c => this.getDeptManagerUserId(c)));
    const unique = [...new Set(userIds.filter(Boolean))] as string[];
    for (const userId of unique) {
      await this.insertNotif(userId, { appointmentId: appt.id }, 'موعد معاينة جديد', msg);
    }
  }

  // ── Leave & Conflict checks ─────────────────────────────────────────────────

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

  private async checkConflict(
    practitionerId: string,
    startTime: Date,
    endTime: Date,
    excludeId?: string,
    therapistIds?: string[],
  ) {
    const timeWhere: any = {
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      AND: [
        { startTime: { lt: endTime } },
        { endTime: { gt: startTime } },
      ],
    };
    if (excludeId) timeWhere.id = { not: excludeId };

    if (therapistIds && therapistIds.length > 0) {
      return this.prisma.appointment.findFirst({
        where: { ...timeWhere, therapistIds: { hasSome: therapistIds } },
      });
    }

    return this.prisma.appointment.findFirst({
      where: { ...timeWhere, practitionerId },
    });
  }

  // فحص تعارض المريض بين الأقسام: نفس المريض، وقت متداخل، قسم مختلف
  private async checkPatientCrossServiceConflict(
    patientId: string,
    caseType: string,
    startTime: Date,
    endTime: Date,
    excludeId?: string,
  ) {
    const where: any = {
      patientId,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      caseType: { not: caseType },
      AND: [
        { startTime: { lt: endTime } },
        { endTime: { gt: startTime } },
      ],
    };
    if (excludeId) where.id = { not: excludeId };
    return this.prisma.appointment.findFirst({ where, select: { id: true, caseType: true, startTime: true } });
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  async create(dto: CreateAppointmentDto, userId: string) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    if (endTime <= startTime) throw new BadRequestException('endTime must be after startTime');

    const conflict = await this.checkConflict(dto.practitionerId, startTime, endTime, undefined, dto.therapistIds);
    if (conflict) throw new BadRequestException('Practitioner has a conflicting appointment at this time');

    if (dto.caseType) {
      const crossConflict = await this.checkPatientCrossServiceConflict(dto.patientId, dto.caseType, startTime, endTime);
      if (crossConflict) throw new BadRequestException('المريض لديه موعد في قسم آخر خلال هذا الوقت — لا يمكن حجز موعدين متزامنين في قسمين مختلفين');
    }

    const onLeave = await this.checkLeaveOverlap(dto.practitionerId, startTime, endTime);
    if (onLeave) throw new BadRequestException('Practitioner is on approved leave during this time');

    const appt = await this.prisma.appointment.create({
      data: {
        patientId:         dto.patientId,
        caseId:            dto.caseId,
        caseType:          dto.caseType as any,
        practitionerId:    dto.practitionerId,
        practitionerRole:  dto.practitionerRole ?? null,
        departmentId:      dto.departmentId ?? null,
        physiotherapistId: dto.physiotherapistId ?? null,
        therapistIds:      dto.therapistIds ?? [],
        appointmentType:   dto.appointmentType as any,
        startTime,
        endTime,
        durationMinutes:   dto.durationMinutes ?? 60,
        notes:             dto.notes,
        createdBy:         userId,
      },
    });

    const tz = { timeZone: 'Asia/Riyadh' };
    const dateStr = startTime.toLocaleDateString('en-GB', tz);
    const timeStr = startTime.toLocaleTimeString('en-GB', { ...tz, hour: '2-digit', minute: '2-digit' });
    const msg = `تم حجز موعد جديد بتاريخ ${dateStr} الساعة ${timeStr}`;

    if (dto.appointmentType === 'EXAMINATION') {
      await this.notifyExaminationDeptHeads(appt, dto.practitionerRole, msg);
    } else {
      await this.notifyPractitioner(appt as any, 'موعد جديد', msg);
    }

    // رسالة داخلية للممارس وكل المعالجين
    const mailRecipients = [...new Set([
      dto.practitionerId,
      ...(dto.physiotherapistId ? [dto.physiotherapistId] : []),
      ...(dto.therapistIds ?? []),
    ])];
    fetch(`${process.env.MAIL_SERVICE_URL || 'http://mail:4005'}/api/v1/mail/internal/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '' },
      body: JSON.stringify({ senderId: userId, recipientUserIds: mailRecipients, subject: 'موعد جديد', body: msg, data: { appointmentId: appt.id } }),
    }).catch(() => {});

    return appt;
  }

  private async attachPatientNames<T extends { patientId: string }>(items: T[]): Promise<(T & { patientName: string; patientNumber: string })[]> {
    if (items.length === 0) return items.map(i => ({ ...i, patientName: '', patientNumber: '' }));
    const ids = [...new Set(items.map(i => i.patientId))];
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const patients = await this.prisma.$queryRawUnsafe<Array<{ id: string; firstName: string; lastName: string; patientNumber: string }>>(
      `SELECT id, "firstName", "lastName", "patientNumber" FROM clinic_patients.patients WHERE id IN (${placeholders})`,
      ...ids,
    );
    const map = new Map(patients.map(p => [p.id, { name: `${p.firstName} ${p.lastName}`, number: p.patientNumber }]));
    return items.map(i => ({
      ...i,
      patientName: map.get(i.patientId)?.name ?? '',
      patientNumber: map.get(i.patientId)?.number ?? '',
    }));
  }

  async findAll(query: ListAppointmentsQueryDto) {
    const { page = 1, limit = 50, patientId, practitionerId, departmentId, status, date } = query;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (patientId) where.patientId = patientId;
    if (practitionerId) where.practitionerId = practitionerId;
    if (departmentId) where.departmentId = departmentId;
    if (status) where.status = status;
    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.startTime = { gte: d, lt: next };
    }

    const [raw, total] = await Promise.all([
      this.prisma.appointment.findMany({ where, skip, take: limit, orderBy: { startTime: 'asc' } }),
      this.prisma.appointment.count({ where }),
    ]);
    const items = await this.attachPatientNames(raw);
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
    const raw = await this.prisma.appointment.findMany({ where, orderBy: { startTime: 'asc' } });
    return this.attachPatientNames(raw);
  }

  async findPatientsByPractitioner(practitionerId: string | null, canViewAll: boolean) {
    const where: any = { status: { not: 'CANCELLED' as any } };
    if (!canViewAll) {
      if (!practitionerId) return [];
      where.OR = [
        { practitionerId },
        { physiotherapistId: practitionerId },
      ];
    }
    const rows = await this.prisma.appointment.findMany({
      where,
      select: { patientId: true },
      distinct: ['patientId'],
    });
    return rows.map(r => r.patientId);
  }

  private async getWorkHours(practitionerId: string, dateStr: string): Promise<{ start: number; end: number; isWorkDay: boolean }> {
    const fallback = { start: 8, end: 17, isWorkDay: true };
    try {
      const url = `${process.env.ATTENDANCE_SERVICE_URL || 'http://attendance:4004'}/api/v1/employee-schedules/internal/${practitionerId}/for-date?date=${dateStr}`;
      const res = await fetch(url, { headers: { 'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '' } });
      if (!res.ok) return fallback;
      const json = await res.json() as any;
      const d = json?.data ?? json;
      if (!d?.found) return fallback;
      const parseHour = (t: string | null, def: number) => {
        if (!t) return def;
        const h = parseInt(String(t).split(':')[0], 10);
        return Number.isFinite(h) ? h : def;
      };
      return {
        start: parseHour(d.workStartTime, 8),
        end: parseHour(d.workEndTime, 17),
        isWorkDay: d.isWorkDay !== false,
      };
    } catch {
      return fallback;
    }
  }

  async getAvailableSlots(practitionerId: string, query: SlotsQueryDto) {
    const date = new Date(query.date);
    const slotDuration = query.slotDurationMinutes ?? 60;

    const dateStr = date.toISOString().split('T')[0];
    const wh = await this.getWorkHours(practitionerId, dateStr);
    if (!wh.isWorkDay) return [];

    const dayStart = new Date(date);
    dayStart.setHours(wh.start, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(wh.end, 0, 0, 0);

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

  async findMyAppointments(userId: string, query: { status?: string; date?: string; page?: number; limit?: number }) {
    const { page = 1, limit = 50, status, date } = query;
    const skip = (page - 1) * limit;
    const where: any = {
      OR: [
        { practitionerId: userId },
        { physiotherapistId: userId },
        { therapistIds: { has: userId } },
      ],
    };
    if (status) where.status = status;
    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.startTime = { gte: d, lt: next };
    }
    const [raw, total] = await Promise.all([
      this.prisma.appointment.findMany({ where, skip, take: limit, orderBy: { startTime: 'asc' } }),
      this.prisma.appointment.count({ where }),
    ]);
    const items = await this.attachPatientNames(raw);
    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const a = await this.prisma.appointment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Appointment not found');
    const [withName] = await this.attachPatientNames([a]);
    return withName;
  }

  async update(id: string, dto: UpdateAppointmentDto, userId: string) {
    const existing = await this.findOne(id);
    const data: any = {};
    if (dto.startTime && dto.endTime) {
      const startTime = new Date(dto.startTime);
      const endTime = new Date(dto.endTime);
      const conflict = await this.checkConflict(existing.practitionerId, startTime, endTime, id, dto.therapistIds ?? (existing as any).therapistIds);
      if (conflict) throw new BadRequestException('Conflicting appointment exists');
      if (existing.caseType) {
        const crossConflict = await this.checkPatientCrossServiceConflict(existing.patientId, existing.caseType as string, startTime, endTime, id);
        if (crossConflict) throw new BadRequestException('المريض لديه موعد في قسم آخر خلال هذا الوقت — لا يمكن حجز موعدين متزامنين في قسمين مختلفين');
      }
      data.startTime = startTime;
      data.endTime = endTime;
    } else if (dto.startTime) {
      data.startTime = new Date(dto.startTime);
    } else if (dto.endTime) {
      data.endTime = new Date(dto.endTime);
    }
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.appointmentType) data.appointmentType = dto.appointmentType as any;
    if (dto.departmentId !== undefined) data.departmentId = dto.departmentId;
    if (dto.physiotherapistId !== undefined) data.physiotherapistId = dto.physiotherapistId;
    if (dto.therapistIds !== undefined) {
      data.therapistIds = dto.therapistIds;
      const prevIds: string[] = (existing as any).therapistIds ?? [];
      const newIds = dto.therapistIds.filter(t => !prevIds.includes(t));
      if (newIds.length > 0) {
        const apptTime = existing.startTime;
        const tz = { timeZone: 'Asia/Riyadh' };
        const dateStr = apptTime.toLocaleDateString('en-GB', tz);
        const timeStr = apptTime.toLocaleTimeString('en-GB', { ...tz, hour: '2-digit', minute: '2-digit' });
        for (const tid of newIds) {
          await this.insertNotif(tid, { appointmentId: id }, 'تعيين موعد', `تم تعيينك معالجاً في موعد بتاريخ ${dateStr} الساعة ${timeStr}`);
        }
      }
    }
    return this.prisma.appointment.update({ where: { id }, data });
  }

  async cancel(id: string, reason?: string) {
    const appt = await this.findOne(id);
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' as any, cancelledReason: reason },
    });
    const msg = reason ? `تم إلغاء موعدك. السبب: ${reason}` : 'تم إلغاء موعدك';
    const supervisorMsg = reason ? `تم إلغاء موعد للمريض. السبب: ${reason}` : 'تم إلغاء موعد للمريض';
    await Promise.all([
      this.notifyPractitioner(appt as any, 'تم إلغاء الموعد', msg),
      this.notifySupervisors(appt, supervisorMsg),
    ]);
    return updated;
  }

  async reschedule(id: string, dto: RescheduleDto) {
    const appt = await this.findOne(id);
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    const conflict = await this.checkConflict(appt.practitionerId, startTime, endTime, id, (appt as any).therapistIds);
    if (conflict) throw new BadRequestException('Conflicting appointment exists');
    if (appt.caseType) {
      const crossConflict = await this.checkPatientCrossServiceConflict(appt.patientId, appt.caseType as string, startTime, endTime, id);
      if (crossConflict) throw new BadRequestException('المريض لديه موعد في قسم آخر خلال هذا الوقت — لا يمكن حجز موعدين متزامنين في قسمين مختلفين');
    }
    return this.prisma.appointment.update({
      where: { id },
      data: { startTime, endTime, status: 'RESCHEDULED' as any, notes: dto.notes },
    });
  }

  async updateStatus(id: string, dto: UpdateStatusDto) {
    const appt = await this.findOne(id);
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: dto.status as any,
        cancelledReason: dto.cancelledReason,
      },
    });
    if (dto.status === 'CANCELLED') {
      const msg = dto.cancelledReason ? `تم إلغاء موعدك. السبب: ${dto.cancelledReason}` : 'تم إلغاء موعدك';
      const supervisorMsg = dto.cancelledReason ? `تم إلغاء موعد للمريض. السبب: ${dto.cancelledReason}` : 'تم إلغاء موعد للمريض';
      await Promise.all([
        this.notifyPractitioner(appt as any, 'تم إلغاء الموعد', msg),
        this.notifySupervisors(appt, supervisorMsg),
      ]);
    }

    if (dto.status === 'CONFIRMED' && (appt as any).caseType === 'PROSTHETICS' && (appt as any).caseId) {
      const url = `${process.env.PROSTHETICS_SERVICE_URL || 'http://clinical-prosthetics:4011'}/api/v1/prosthetics/cases/internal/treatment-program-from-appointment`;
      const sessionTime = appt.startTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' });
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '',
        },
        body: JSON.stringify({
          caseId: (appt as any).caseId,
          sessionDate: appt.startTime.toISOString(),
          sessionTime,
        }),
      }).catch(() => {});
    }

    return updated;
  }
}
