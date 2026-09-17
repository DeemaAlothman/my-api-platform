import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceAlertsService } from '../attendance-alerts/attendance-alerts.service';
import { UnifiedComputationService } from '../common/services/unified-computation.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { CreateAttendanceRecordDto } from './dto/create-attendance-record.dto';
import { UpdateAttendanceRecordDto } from './dto/update-attendance-record.dto';

@Injectable()
export class AttendanceRecordsService {
  constructor(
    private prisma: PrismaService,
    private attendanceAlertsService: AttendanceAlertsService,
    private unifiedComputation: UnifiedComputationService,
  ) {}

  private async getEmployeeNames(employeeIds: string[]) {
    if (employeeIds.length === 0) return new Map<string, any>();

    const employees = (await this.prisma.$queryRawUnsafe(
      `SELECT id, "employeeNumber", "firstNameAr", "lastNameAr", "firstNameEn", "lastNameEn"
       FROM users.employees
       WHERE id::text = ANY($1::text[])`,
      employeeIds,
    )) as Array<{ id: string; employeeNumber: string; firstNameAr: string; lastNameAr: string; firstNameEn: string | null; lastNameEn: string | null }>;

    return new Map(employees.map(e => [e.id, {
      employeeNumber: e.employeeNumber,
      firstNameAr: e.firstNameAr,
      lastNameAr: e.lastNameAr,
      firstNameEn: e.firstNameEn,
      lastNameEn: e.lastNameEn,
    }]));
  }

  async checkIn(employeeId: string, dto: CheckInDto) {
    const now = new Date();
    const dateObj = dto.date ? new Date(dto.date) : now;

    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);

    // التحقق من أن الموظف غير محذوف
    const empCheck = await this.prisma.$queryRawUnsafe(
      `SELECT id FROM users.employees WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1`,
      employeeId,
    ) as Array<{ id: string }>;
    if (!empCheck[0]) {
      throw new BadRequestException({ code: 'EMPLOYEE_NOT_FOUND', message: 'الموظف غير موجود أو تم حذفه', details: [] });
    }

    // رفض التواريخ الماضية
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startOfDay < today) {
      throw new BadRequestException({
        code: 'INVALID_DATE',
        message: 'لا يمكن تسجيل الحضور لتاريخ ماضٍ',
        details: [],
      });
    }

    // Check if already checked in today
    const existing = await this.prisma.attendanceRecord.findFirst({
      where: {
         employeeId,
    date: startOfDay,  // ✅ استخدام التاريخ مباشرة
    clockInTime: { not: null },
    clockOutTime: null,
      },
    });

    if (existing) {
      throw new BadRequestException({
        code: 'ALREADY_CHECKED_IN',
        message: 'Already checked in for today',
        details: [{ date: dateObj, clockInTime: existing.clockInTime }],
      });
    }

    const clockInTime = dto.checkInTime ? new Date(dto.checkInTime) : now;

    // حساب موحد: status + lateMinutes (مع طرح tolerance + دعم FLEXIBLE + ورديات ليلية)
    const computed = await this.unifiedComputation.compute({
      employeeId,
      date: startOfDay,
      clockInTime,
      clockOutTime: null,
      totalBreakMinutes: 0,
    });

    // جلب إعدادات الراتب للموظف
    const config = await this.prisma.employeeAttendanceConfig.findUnique({
      where: { employeeId },
    });
    const salaryLinked = config?.salaryLinked ?? true;

    // الموظف غير المرتبط بالراتب: نسجّل الحضور الفعلي فقط، بدون تأخير/استقطاعات (غير ذات معنى له)
    const status = salaryLinked ? computed.status : (computed.status === 'LATE' ? 'PRESENT' : computed.status);
    const lateMinutes = salaryLinked ? computed.lateMinutes : 0;

    const record = await this.prisma.attendanceRecord.create({
      data: {
        employeeId,
        date: startOfDay,
        clockInTime,
        clockInLocation: dto.location,
        notes: dto.notes,
        status,
        lateMinutes,
        source: (dto as any).source || 'WEB',
        deviceSN: (dto as any).deviceSN || null,
        salaryLinked,
      },
    });

    // Auto-create alert if late
    if (salaryLinked && computed.status === 'LATE') {
      await this.attendanceAlertsService.create({
        employeeId,
        date: startOfDay.toISOString().split('T')[0],
        alertType: 'LATE',
        severity: computed.lateMinutes > 30 ? 'HIGH' : 'MEDIUM',
        message: `Employee checked in ${computed.lateMinutes} minutes late`,
        messageAr: `الموظف تأخر ${computed.lateMinutes} دقيقة`,
        attendanceRecordId: record.id,
      });
    }

    return record;
  }

  async checkOut(employeeId: string, dto: CheckOutDto) {
    const now = new Date();
    const dateObj = dto.date ? new Date(dto.date) : now;

    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);

    // رفض التواريخ الماضية
    const todayForCheckout = new Date();
    todayForCheckout.setHours(0, 0, 0, 0);
    if (startOfDay < todayForCheckout) {
      throw new BadRequestException({
        code: 'INVALID_DATE',
        message: 'لا يمكن تسجيل الانصراف لتاريخ ماضٍ',
        details: [],
      });
    }

    // Find today's check-in record
    const record = await this.prisma.attendanceRecord.findFirst({
      where: {
        employeeId,
        date: startOfDay,
        clockInTime: { not: null },
        clockOutTime: null,
      },
    });

    if (!record) {
      throw new NotFoundException({
        code: 'NO_CHECK_IN_FOUND',
        message: 'No check-in record found for today',
        details: [{ date: dateObj }],
      });
    }

    const clockOutTime = dto.checkOutTime ? new Date(dto.checkOutTime) : now;

    // أغلق أي break مفتوح قبل الخروج
    const openBreak = await this.prisma.attendanceBreak.findFirst({
      where: { attendanceRecordId: record.id, breakIn: null },
      orderBy: { breakOut: 'desc' },
    });
    if (openBreak) {
      const breakDuration = Math.max(0, Math.round((clockOutTime.getTime() - openBreak.breakOut.getTime()) / 60000));
      await this.prisma.attendanceBreak.update({
        where: { id: openBreak.id },
        data: { breakIn: clockOutTime, durationMinutes: breakDuration },
      });
    }

    // احسب totalBreakMinutes
    const allBreaks = await this.prisma.attendanceBreak.findMany({
      where: { attendanceRecordId: record.id },
    });
    const totalBreakMinutes = allBreaks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0);

    // حساب موحد: كل الأرقام (مع tolerance + FLEXIBLE + ورديات ليلية)
    const computed = await this.unifiedComputation.compute({
      employeeId,
      date: startOfDay,
      clockInTime: record.clockInTime,
      clockOutTime,
      totalBreakMinutes,
    });

    // جلب إعدادات الراتب للموظف
    const config = await this.prisma.employeeAttendanceConfig.findUnique({
      where: { employeeId },
    });
    const salaryLinked = (record as any).salaryLinked ?? config?.salaryLinked ?? true;

    // الموظف غير المرتبط بالراتب: نسجّل أوقات الحضور الفعلية فقط، بدون تأخير/خروج مبكر/استقطاعات
    const status = salaryLinked ? computed.status : (['LATE', 'EARLY_LEAVE'].includes(computed.status) ? 'PRESENT' : computed.status);
    const lateMinutes = salaryLinked ? computed.lateMinutes : 0;
    const earlyLeaveMinutes = salaryLinked ? computed.earlyLeaveMinutes : 0;

    const updatedRecord = await this.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        clockOutTime,
        clockOutLocation: dto.location,
        workedMinutes: computed.workedMinutes,
        netWorkedMinutes: computed.netWorkedMinutes,
        lateMinutes,
        earlyLeaveMinutes,
        overtimeMinutes: computed.overtimeMinutes,
        lateCompensatedMinutes: computed.lateCompensatedMinutes,
        status,
        totalBreakMinutes,
      },
    });

    // Auto-create alert if early leave
    if (salaryLinked && computed.earlyLeaveMinutes > 0) {
      await this.attendanceAlertsService.create({
        employeeId,
        date: startOfDay.toISOString().split('T')[0],
        alertType: 'EARLY_LEAVE',
        severity: computed.earlyLeaveMinutes > 60 ? 'HIGH' : 'MEDIUM',
        message: `Employee left ${computed.earlyLeaveMinutes} minutes early`,
        messageAr: `الموظف غادر مبكراً بـ ${computed.earlyLeaveMinutes} دقيقة`,
        attendanceRecordId: updatedRecord.id,
      });
    }

    return updatedRecord;
  }

  async create(dto: CreateAttendanceRecordDto, createdByUserId?: string) {
    const dateObj = new Date(dto.date);
    dateObj.setHours(0, 0, 0, 0);

    // التحقق من أن الموظف غير محذوف
    const empCheck = await this.prisma.$queryRawUnsafe(
      `SELECT id FROM users.employees WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1`,
      dto.employeeId,
    ) as Array<{ id: string }>;
    if (!empCheck[0]) {
      throw new BadRequestException(`الموظف غير موجود أو تم حذفه`);
    }

    // منع تكرار السجل لنفس الموظف في نفس اليوم
    const existing = await this.prisma.attendanceRecord.findFirst({
      where: { employeeId: dto.employeeId, date: dateObj },
    });
    if (existing) {
      throw new BadRequestException(`سجل حضور موجود مسبقاً لهذا الموظف في هذا اليوم`);
    }

    const data: any = {
      employeeId: dto.employeeId,
      date: dateObj,
      status: dto.status || 'PRESENT',
      lateMinutes: dto.lateMinutes || 0,
      earlyLeaveMinutes: dto.earlyLeaveMinutes || 0,
      isManualEntry: true,
      manualEntryBy: createdByUserId ?? null,
      manualEntryReason: dto.manualEntryReason ?? null,
    };

    if (dto.clockInTime) data.clockInTime = new Date(dto.clockInTime);
    if (dto.clockOutTime) data.clockOutTime = new Date(dto.clockOutTime);
    if (dto.workedMinutes !== undefined) data.workedMinutes = dto.workedMinutes;
    if (dto.overtimeMinutes !== undefined) data.overtimeMinutes = dto.overtimeMinutes;
    if (dto.clockInLocation) data.clockInLocation = dto.clockInLocation;
    if (dto.clockOutLocation) data.clockOutLocation = dto.clockOutLocation;
    if (dto.notes) data.notes = dto.notes;

    return this.prisma.attendanceRecord.create({ data });
  }

  async findAll(filters?: {
    employeeId?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    page?: number | string;
    limit?: number | string;
  }) {
    const where: any = {};

    if (filters?.employeeId) where.employeeId = filters.employeeId;
    if (filters?.status) where.status = filters.status;
    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {};
      if (filters.dateFrom) where.date.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.date.lte = new Date(filters.dateTo);
    }

    const page = Math.max(1, Number(filters?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters?.limit) || 10));
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.attendanceRecord.count({ where }),
    ]);

    const employeeIds = [...new Set(records.map((r: any) => r.employeeId))] as string[];
    const employeeMap = await this.getEmployeeNames(employeeIds);

    // عرض فقط — لا تعديل على أي بيانات مخزَّنة: نعيد حساب دقائق التأخير "الصحيحة" (سماحية تُمنح
    // فقط عند تعويضها فعلياً بالبقاء بعد الدوام، لا مجاناً) للعرض بهذه الصفحة تحديداً، بنفس منطق
    // تصحيح الراتب المطبَّق أصلاً — بدون أي UPDATE على attendance_records
    const scheduleByEmployee = new Map<string, { workStartTime: string | null; workEndTime: string | null; shiftType: string }>();
    if (employeeIds.length > 0) {
      const employeeSchedules = await this.prisma.employeeSchedule.findMany({
        where: { employeeId: { in: employeeIds }, isActive: true },
        include: { schedule: true },
        orderBy: { effectiveFrom: 'desc' },
      });
      for (const es of employeeSchedules) {
        if (!scheduleByEmployee.has(es.employeeId)) {
          scheduleByEmployee.set(es.employeeId, {
            workStartTime: es.schedule?.workStartTime ?? null,
            workEndTime: es.schedule?.workEndTime ?? null,
            shiftType: (es.schedule as any)?.shiftType ?? 'DAY',
          });
        }
      }
    }

    const justifiedLateRecordIds = new Set<string>();
    const justifiedEarlyLeaveRecordIds = new Set<string>();
    const recordIds = records.map((r: any) => r.id);
    if (recordIds.length > 0) {
      const justified: Array<{ attendanceRecordId: string; alertType: string }> = await this.prisma.$queryRawUnsafe(`
        SELECT aj."attendanceRecordId", aa."alertType"
        FROM attendance.attendance_justifications aj
        JOIN attendance.attendance_alerts aa ON aa.id = aj."alertId"
        WHERE aj."attendanceRecordId" = ANY($1::text[])
          AND aj.status IN ('HR_APPROVED', 'MANAGER_APPROVED')
          AND aa."alertType" IN ('LATE', 'EARLY_LEAVE')
      `, recordIds);
      for (const j of justified) {
        if (j.alertType === 'LATE') justifiedLateRecordIds.add(j.attendanceRecordId);
        else justifiedEarlyLeaveRecordIds.add(j.attendanceRecordId);
      }
    }

    // إجازة ساعية يدوية معتمدة تُغطّي بداية/نهاية الدوام الرسمي بالضبط (غياب معتمد رسمياً، مش
    // تأخير/خروج مبكر حقيقي) — مؤكَّد بحالة حقيقية: إجازة 16:00-18:00 (تطابق نهاية الدوام 18:00)
    // كانت تُحسب خطأً كخروج مبكر قبل هذا الإصلاح. نفس منطق تصحيح الراتب بالضبط.
    const morningCoverageByEmployeeDate = new Map<string, number>();
    const eveningCoverageByEmployeeDate = new Map<string, number>();
    if (employeeIds.length > 0) {
      const manualHourlyLeaveRows: Array<{ employeeId: string; date: Date; startTime: string; endTime: string; durationHours: number }> =
        await this.prisma.$queryRawUnsafe(`
          SELECT lr."employeeId", lr."startDate" as date, lr."startTime", lr."endTime", lr."durationHours"
          FROM leaves.leave_requests lr
          WHERE lr."employeeId" = ANY($1::text[]) AND lr.status = 'APPROVED' AND lr."isHourlyLeave" = true
            AND (lr.source IS NULL OR lr.source = 'EMPLOYEE_REQUEST')
            AND lr."startTime" IS NOT NULL AND lr."endTime" IS NOT NULL
        `, employeeIds);
      for (const leave of manualHourlyLeaveRows) {
        const sched = scheduleByEmployee.get(leave.employeeId);
        if (!sched?.workStartTime || !sched?.workEndTime) continue;
        const dk = new Date(leave.date).toISOString().split('T')[0];
        const key = `${leave.employeeId}|${dk}`;
        const minutes = Math.round((leave.durationHours || 0) * 60);
        if (leave.startTime <= sched.workStartTime) {
          morningCoverageByEmployeeDate.set(key, (morningCoverageByEmployeeDate.get(key) ?? 0) + minutes);
        }
        if (leave.endTime >= sched.workEndTime) {
          eveningCoverageByEmployeeDate.set(key, (eveningCoverageByEmployeeDate.get(key) ?? 0) + minutes);
        }
      }
    }

    // إجازة نصف يوم معتمدة (صبح أو بعد الظهر): نهاية/بداية الدوام المطلوبة لهذا اليوم تصير
    // منتصف الدوام فقط، مش الوقت الكامل — نفس منطق تصحيح الراتب بالضبط. مؤكَّد بحالة حقيقية:
    // موظفة عندها إجازة نصف يوم بعد الظهر معتمدة، واعتُبر خروجها بعد الصبح "خروج مبكر" 256
    // دقيقة (بمقارنته بنهاية الدوام الكامل) بدل ~30 دقيقة فقط (بمقارنته بمنتصف الدوام).
    const halfDayLeaveByEmployeeDate = new Map<string, 'MORNING' | 'AFTERNOON'>();
    if (employeeIds.length > 0) {
      const halfDayLeaveRows: Array<{ employeeId: string; date: Date; halfDayPeriod: 'MORNING' | 'AFTERNOON' }> =
        await this.prisma.$queryRawUnsafe(`
          SELECT lr."employeeId", lr."startDate" as date, lr."halfDayPeriod"
          FROM leaves.leave_requests lr
          WHERE lr."employeeId" = ANY($1::text[]) AND lr.status = 'APPROVED' AND lr."isHalfDay" = true
            AND lr."halfDayPeriod" IS NOT NULL
        `, employeeIds);
      for (const leave of halfDayLeaveRows) {
        const dk = new Date(leave.date).toISOString().split('T')[0];
        halfDayLeaveByEmployeeDate.set(`${leave.employeeId}|${dk}`, leave.halfDayPeriod);
      }
    }

    const excludedStatusesForDisplay = new Set(['ABSENT', 'WEEKEND', 'HOLIDAY', 'ON_LEAVE', 'ON_MISSION']);

    const items = records.map((record: any) => {
      let displayLateMinutes = record.lateMinutes;
      let displayEarlyLeaveMinutes = record.earlyLeaveMinutes;
      let displayStatus = record.status;

      const sched = scheduleByEmployee.get(record.employeeId);
      const canRecompute =
        record.clockInTime && sched?.workStartTime && sched?.workEndTime &&
        sched.shiftType !== 'FLEXIBLE' && !excludedStatusesForDisplay.has(record.status);

      if (canRecompute) {
        const [startH, startM] = sched!.workStartTime!.split(':').map(Number);
        const [endH, endM] = sched!.workEndTime!.split(':').map(Number);
        const recDate = new Date(record.date);
        // خادم الحاوية يشتغل بتوقيت UTC صافٍ (تأكدنا: docker exec ... date → UTC)، بينما
        // "workStartTime/workEndTime" مقصودة بتوقيت العمل المحلي (UTC+3) — استخدام setHours()
        // هنا كان يحسبها كـUTC مباشرة (فرق 3 ساعات غلط). الحل: بناء الوقت بـUTC صراحة مع طرح
        // فرق التوقيت، بغض النظر عن توقيت السيرفر. (نفس الخطأ موجود أصلاً بمحرك الحضور الأساسي
        // attendance-computation.service.ts، وهو سبب تناقض نتائج فاطمة الخلف وغيرها — هذا تصحيح
        // للعرض فقط، صفر لمس على البيانات المخزَّنة أو المحرك الأساسي)
        const BUSINESS_UTC_OFFSET_HOURS = 3;
        // سماحية موحّدة (بحد أقصى) للتعويض بين الدخول والخروج — بطلب صريح، مش تعويض غير محدود:
        // لو جا متأخر ساعة وبقي بعد الدوام ساعة، ينسامح منها 15 دقيقة بس، والباقي يُحسب تأخير.
        const GRACE_PERIOD_MINUTES = 15;
        let schedStart = new Date(Date.UTC(
          recDate.getUTCFullYear(), recDate.getUTCMonth(), recDate.getUTCDate(),
          startH - BUSINESS_UTC_OFFSET_HOURS, startM, 0, 0,
        ));
        let schedEnd = new Date(Date.UTC(
          recDate.getUTCFullYear(), recDate.getUTCMonth(), recDate.getUTCDate(),
          endH - BUSINESS_UTC_OFFSET_HOURS, endM, 0, 0,
        ));
        if (schedEnd <= schedStart) schedEnd = new Date(schedEnd.getTime() + 24 * 60 * 60 * 1000);

        const dateKeyForHalfDay = new Date(record.date).toISOString().split('T')[0];
        const halfDayPeriod = halfDayLeaveByEmployeeDate.get(`${record.employeeId}|${dateKeyForHalfDay}`);
        if (halfDayPeriod === 'AFTERNOON' || halfDayPeriod === 'MORNING') {
          const midTotalMin = Math.floor(((startH * 60 + startM) + (endH * 60 + endM)) / 2);
          const midH = Math.floor(midTotalMin / 60);
          const midM = midTotalMin % 60;
          const midShift = new Date(Date.UTC(
            recDate.getUTCFullYear(), recDate.getUTCMonth(), recDate.getUTCDate(),
            midH - BUSINESS_UTC_OFFSET_HOURS, midM, 0, 0,
          ));
          if (halfDayPeriod === 'AFTERNOON') schedEnd = midShift;
          else schedStart = midShift;
        }

        const clockIn = new Date(record.clockInTime);
        const clockOut = record.clockOutTime ? new Date(record.clockOutTime) : null;
        const coverageKey = `${record.employeeId}|${new Date(record.date).toISOString().split('T')[0]}`;
        const morningCoverage = morningCoverageByEmployeeDate.get(coverageKey) ?? 0;
        const eveningCoverage = eveningCoverageByEmployeeDate.get(coverageKey) ?? 0;
        const rawLate = Math.max(0, Math.round((clockIn.getTime() - schedStart.getTime()) / 60000) - morningCoverage);
        const earlyArrival = Math.max(0, Math.round((schedStart.getTime() - clockIn.getTime()) / 60000));

        if (justifiedLateRecordIds.has(record.id)) {
          displayLateMinutes = 0;
        } else {
          const excessAtEnd = clockOut ? Math.max(0, Math.round((clockOut.getTime() - schedEnd.getTime()) / 60000)) : 0;
          const lateForgiven = Math.min(excessAtEnd, GRACE_PERIOD_MINUTES);
          displayLateMinutes = Math.max(0, rawLate - lateForgiven);
        }

        if (justifiedEarlyLeaveRecordIds.has(record.id)) {
          displayEarlyLeaveMinutes = 0;
        } else if (clockOut) {
          const rawEarlyLeave = Math.max(0, Math.round((schedEnd.getTime() - clockOut.getTime()) / 60000) - eveningCoverage);
          const earlyLeaveForgiven = Math.min(earlyArrival, GRACE_PERIOD_MINUTES);
          displayEarlyLeaveMinutes = Math.max(0, rawEarlyLeave - earlyLeaveForgiven);
        } else {
          displayEarlyLeaveMinutes = 0;
        }

        // إعادة تحديد الحالة بالكامل من الرقمين المصحَّحين (لا تصحيح جزئي) — يطابق منطق
        // المحرك الأساسي تماماً، ويرجّع الحالة لـ"حاضر" لو الدقائق صارت صفر (كانت تعلق على
        // "خروج مبكر"/"متأخر" القديمة الخطأ من غير ما ترجع تنزل). لا تلمس حالات خاصة أخرى
        // (إجازة جزئية، نصف يوم، إلخ) — تلك تحتفظ بتصنيفها الأصلي، فقط الدقائق تتصحح للعرض.
        const normalStatusesForRederivation = new Set(['PRESENT', 'LATE', 'EARLY_LEAVE']);
        if (normalStatusesForRederivation.has(record.status)) {
          if (displayLateMinutes > 0) displayStatus = 'LATE';
          else if (displayEarlyLeaveMinutes > 0) displayStatus = 'EARLY_LEAVE';
          else displayStatus = 'PRESENT';
        }
      }

      return {
        ...record,
        lateMinutes: displayLateMinutes,
        earlyLeaveMinutes: displayEarlyLeaveMinutes,
        status: displayStatus,
        employee: employeeMap.get(record.employeeId) || null,
      };
    });

    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async findOne(id: string) {
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException({
        code: 'ATTENDANCE_RECORD_NOT_FOUND',
        message: 'Attendance record not found',
        details: [{ id }],
      });
    }

    const employeeMap = await this.getEmployeeNames([record.employeeId]);

    return {
      ...record,
      employee: employeeMap.get(record.employeeId) || null,
    };
  }

  async update(id: string, dto: UpdateAttendanceRecordDto, userId?: string) {
    const existing = await this.findOne(id);

    const attendanceChanged =
      (dto as any).lateMinutes !== undefined ||
      (dto as any).earlyLeaveMinutes !== undefined ||
      (dto as any).status !== undefined;

    const updateData: any = { ...dto };
    if (attendanceChanged) {
      updateData.tardinessPendingDeductionMinutes = 0;
      updateData.earlyLeavePendingDeductionMinutes = 0;
    }

    const updated = await this.prisma.attendanceRecord.update({
      where: { id },
      data: updateData,
    });

    const trackedFields = ['status', 'lateMinutes', 'earlyLeaveMinutes', 'overtimeMinutes', 'clockInTime', 'clockOutTime', 'workedMinutes', 'netWorkedMinutes'];
    const changedFields: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of trackedFields) {
      const before = (existing as any)[key];
      const after = (updated as any)[key];
      if (String(before) !== String(after)) changedFields[key] = { from: before, to: after };
    }

    if (Object.keys(changedFields).length > 0) {
      await this.prisma.$queryRawUnsafe(
        `INSERT INTO attendance.attendance_computation_logs
           (id, "attendanceRecordId", "employeeId", date, action, source, "changedFields", "performedBy", notes, "createdAt")
         VALUES
           (gen_random_uuid(), $1, $2, $3::date, 'MANUAL_UPDATE', 'HTTP', $4, $5, 'Manual update via API', NOW())`,
        id,
        existing.employeeId,
        (existing as any).date,
        JSON.stringify(changedFields),
        userId || 'UNKNOWN',
      ).catch(() => {});
    }

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.attendanceRecord.delete({
      where: { id },
    });
  }

  async getMyAttendance(employeeId: string, filters?: { dateFrom?: string; dateTo?: string }) {
    if (!employeeId) {
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'لا يوجد سجل موظف مرتبط بحسابك',
        details: [],
      });
    }
    return this.findAll({ ...filters, employeeId });
  }

  async addBreak(employeeId: string, dto: { breakOut: string; breakIn?: string; reason?: string; date?: string }) {
    const dayDate = dto.date ? new Date(dto.date) : new Date();
    const startOfDay = new Date(dayDate);
    startOfDay.setHours(0, 0, 0, 0);

    const record = await this.prisma.attendanceRecord.findFirst({
      where: { employeeId, date: startOfDay, clockInTime: { not: null }, clockOutTime: null },
    });
    if (!record) {
      throw new NotFoundException({ code: 'NO_CHECK_IN_FOUND', message: 'لا يوجد سجل حضور مفتوح لهذا الموظف اليوم' });
    }

    const breakOutTime = new Date(dto.breakOut);
    const breakInTime = dto.breakIn ? new Date(dto.breakIn) : null;
    const durationMinutes = breakInTime
      ? Math.max(0, Math.round((breakInTime.getTime() - breakOutTime.getTime()) / 60000))
      : null;

    const breakRecord = await this.prisma.attendanceBreak.create({
      data: {
        attendanceRecordId: record.id,
        breakOut: breakOutTime,
        breakIn: breakInTime,
        durationMinutes,
        reason: dto.reason,
      },
    });

    // أعد حساب totalBreakMinutes
    const allBreaks = await this.prisma.attendanceBreak.findMany({ where: { attendanceRecordId: record.id } });
    const totalBreakMinutes = allBreaks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
    const netWorkedMinutes = record.workedMinutes ? Math.max(0, record.workedMinutes - totalBreakMinutes) : null;

    await this.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: { totalBreakMinutes, netWorkedMinutes },
    });

    return breakRecord;
  }

  async closeBreak(employeeId: string, dto: { breakIn: string; date?: string }) {
    const dayDate = dto.date ? new Date(dto.date) : new Date();
    const startOfDay = new Date(dayDate);
    startOfDay.setHours(0, 0, 0, 0);

    const record = await this.prisma.attendanceRecord.findFirst({
      where: { employeeId, date: startOfDay, clockInTime: { not: null }, clockOutTime: null },
    });
    if (!record) {
      throw new NotFoundException({ code: 'NO_CHECK_IN_FOUND', message: 'لا يوجد سجل حضور مفتوح' });
    }

    const openBreak = await this.prisma.attendanceBreak.findFirst({
      where: { attendanceRecordId: record.id, breakIn: null },
      orderBy: { breakOut: 'desc' },
    });
    if (!openBreak) {
      throw new NotFoundException({ code: 'NO_OPEN_BREAK', message: 'لا يوجد خروج مؤقت مفتوح' });
    }

    const breakInTime = new Date(dto.breakIn);
    const durationMinutes = Math.max(0, Math.round((breakInTime.getTime() - openBreak.breakOut.getTime()) / 60000));

    const updated = await this.prisma.attendanceBreak.update({
      where: { id: openBreak.id },
      data: { breakIn: breakInTime, durationMinutes },
    });

    // أعد حساب totalBreakMinutes
    const allBreaks = await this.prisma.attendanceBreak.findMany({ where: { attendanceRecordId: record.id } });
    const totalBreakMinutes = allBreaks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
    const netWorkedMinutes = record.workedMinutes ? Math.max(0, record.workedMinutes - totalBreakMinutes) : null;

    await this.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: { totalBreakMinutes, netWorkedMinutes },
    });

    return updated;
  }

  async getBreaks(recordId: string) {
    await this.findOne(recordId);
    return this.prisma.attendanceBreak.findMany({
      where: { attendanceRecordId: recordId },
      orderBy: { breakOut: 'asc' },
    });
  }

  // ─── Phase 3: Manual stamp correction ────────────────────────────────────

  async getRawStamps(recordId: string) {
    const record = await this.findOne(recordId);
    const date: Date = (record as any).date;
    const dayStart = new Date(date.toISOString().split('T')[0] + 'T00:00:00Z');
    const dayEnd = new Date(dayStart.getTime() + 30 * 60 * 60 * 1000); // 30h covers night shifts

    return this.prisma.$queryRawUnsafe(
      `SELECT id, "deviceSN", timestamp, "rawType", "interpretedAs", "pairIndex", "syncError", "createdAt"
       FROM biometric.raw_attendance_logs
       WHERE "employeeId" = $1
         AND timestamp >= $2
         AND timestamp < $3
       ORDER BY timestamp ASC`,
      (record as any).employeeId, dayStart, dayEnd,
    );
  }

  // ─── تقرير تفصيلي شامل ليوم واحد — يجمع كل أسباب الحسم/عدمه بمكان واحد بدون غموض ─────────────
  async getDayDetails(recordId: string) {
    const record = await this.findOne(recordId);
    const employeeId = (record as any).employeeId as string;
    const recDate = new Date((record as any).date);
    const dateStr = recDate.toISOString().split('T')[0];

    const employeeSchedule = await this.prisma.employeeSchedule.findFirst({
      where: { employeeId, isActive: true },
      include: { schedule: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    const sched = employeeSchedule?.schedule;

    // إجازة ساعية يدوية معتمدة بهذا اليوم — لازم نطرحها من التأخير/الخروج المبكر الخام قبل
    // حساب السماحية، تماماً كما بصفحة سجل الحضور وحساب الراتب (fetched early so it can offset
    // the raw late/early-leave minutes below; also reused for display in section 3 further down)
    const manualHourlyLeaveRowsForDay: Array<{
      id: string; startTime: string; endTime: string; durationHours: number; status: string; reason: string | null; typeName: string;
    }> = await this.prisma.$queryRawUnsafe(`
      SELECT lr.id, lr."startTime", lr."endTime", lr."durationHours", lr.status, lr.reason, lt."nameAr" as "typeName"
      FROM leaves.leave_requests lr
      JOIN leaves.leave_types lt ON lt.id = lr."leaveTypeId"
      WHERE lr."employeeId" = $1 AND lr."startDate"::date = $2::date
        AND lr."isHourlyLeave" = true
        AND (lr.source IS NULL OR lr.source = 'EMPLOYEE_REQUEST')
      ORDER BY lr."createdAt" ASC
    `, employeeId, dateStr);
    let morningLeaveCoverageMinutes = 0;
    let eveningLeaveCoverageMinutes = 0;
    if (sched?.workStartTime && sched?.workEndTime) {
      for (const leave of manualHourlyLeaveRowsForDay) {
        if (leave.status !== 'APPROVED') continue;
        const minutes = Math.round((leave.durationHours || 0) * 60);
        if (leave.startTime <= sched.workStartTime) morningLeaveCoverageMinutes += minutes;
        if (leave.endTime >= sched.workEndTime) eveningLeaveCoverageMinutes += minutes;
      }
    }

    // إجازة نصف يوم معتمدة (صبح أو بعد الظهر) بهذا اليوم — نفس منطق تصحيح الراتب وصفحة السجل
    // بالضبط: الدوام المطلوب لهذا اليوم يصير حتى منتصف الدوام فقط
    const halfDayLeaveRowsForDay: Array<{ halfDayPeriod: 'MORNING' | 'AFTERNOON' }> = await this.prisma.$queryRawUnsafe(`
      SELECT lr."halfDayPeriod"
      FROM leaves.leave_requests lr
      WHERE lr."employeeId" = $1 AND lr."startDate"::date = $2::date
        AND lr.status = 'APPROVED' AND lr."isHalfDay" = true AND lr."halfDayPeriod" IS NOT NULL
      LIMIT 1
    `, employeeId, dateStr);
    const halfDayPeriodForDay = halfDayLeaveRowsForDay[0]?.halfDayPeriod;

    // إعادة حساب التأخير/الخروج المبكر بنفس معادلة صفحة سجل الحضور بالضبط (سماحية بحد أقصى 15
    // دقيقة + فرق توقيت UTC+3) — عشان هاد التقرير يطابق الصفحة والراتب تماماً
    let computedLateMinutes = (record as any).lateMinutes ?? 0;
    let computedEarlyLeaveMinutes = (record as any).earlyLeaveMinutes ?? 0;
    const GRACE_PERIOD_MINUTES = 15;
    const BUSINESS_UTC_OFFSET_HOURS = 3;
    const excludedStatuses = new Set(['ABSENT', 'WEEKEND', 'HOLIDAY', 'ON_LEAVE', 'ON_MISSION']);
    if (
      (record as any).clockInTime && sched?.workStartTime && sched?.workEndTime &&
      (sched as any).shiftType !== 'FLEXIBLE' && !excludedStatuses.has((record as any).status)
    ) {
      const [startH, startM] = sched.workStartTime.split(':').map(Number);
      const [endH, endM] = sched.workEndTime.split(':').map(Number);
      let schedStart = new Date(Date.UTC(
        recDate.getUTCFullYear(), recDate.getUTCMonth(), recDate.getUTCDate(),
        startH - BUSINESS_UTC_OFFSET_HOURS, startM, 0, 0,
      ));
      let schedEnd = new Date(Date.UTC(
        recDate.getUTCFullYear(), recDate.getUTCMonth(), recDate.getUTCDate(),
        endH - BUSINESS_UTC_OFFSET_HOURS, endM, 0, 0,
      ));
      if (schedEnd <= schedStart) schedEnd = new Date(schedEnd.getTime() + 24 * 60 * 60 * 1000);

      if (halfDayPeriodForDay === 'AFTERNOON' || halfDayPeriodForDay === 'MORNING') {
        const midTotalMin = Math.floor(((startH * 60 + startM) + (endH * 60 + endM)) / 2);
        const midH = Math.floor(midTotalMin / 60);
        const midM = midTotalMin % 60;
        const midShift = new Date(Date.UTC(
          recDate.getUTCFullYear(), recDate.getUTCMonth(), recDate.getUTCDate(),
          midH - BUSINESS_UTC_OFFSET_HOURS, midM, 0, 0,
        ));
        if (halfDayPeriodForDay === 'AFTERNOON') schedEnd = midShift;
        else schedStart = midShift;
      }

      const clockIn = new Date((record as any).clockInTime);
      const clockOut = (record as any).clockOutTime ? new Date((record as any).clockOutTime) : null;
      const rawLate = Math.max(0, Math.round((clockIn.getTime() - schedStart.getTime()) / 60000) - morningLeaveCoverageMinutes);
      const earlyArrival = Math.max(0, Math.round((schedStart.getTime() - clockIn.getTime()) / 60000));
      const excessAtEnd = clockOut ? Math.max(0, Math.round((clockOut.getTime() - schedEnd.getTime()) / 60000)) : 0;
      const rawEarlyLeave = clockOut ? Math.max(0, Math.round((schedEnd.getTime() - clockOut.getTime()) / 60000) - eveningLeaveCoverageMinutes) : 0;

      computedLateMinutes = Math.max(0, rawLate - Math.min(excessAtEnd, GRACE_PERIOD_MINUTES));
      computedEarlyLeaveMinutes = Math.max(0, rawEarlyLeave - Math.min(earlyArrival, GRACE_PERIOD_MINUTES));
    }

    // 1) تبريرات التأخير/الخروج المبكر المرتبطة بهذا السجل بالذات
    const justificationRows: Array<{
      id: string; status: string; alertType: string; deductionMinutes: number | null;
      managerReviewedAt: Date | null; hrReviewedAt: Date | null; descriptionAr: string | null;
    }> = await this.prisma.$queryRawUnsafe(`
      SELECT aj.id, aj.status, aa."alertType", aj."deductionMinutes",
             aj."managerReviewedAt", aj."hrReviewedAt", aj."descriptionAr"
      FROM attendance.attendance_justifications aj
      JOIN attendance.attendance_alerts aa ON aa.id = aj."alertId"
      WHERE aj."attendanceRecordId" = $1
      ORDER BY aj."createdAt" ASC
    `, recordId);

    const WITH_DEDUCTION_STATUSES = new Set(['HR_APPROVED_WITH_DEDUCTION', 'HR_REJECTED', 'MANAGER_REJECTED', 'AUTO_REJECTED']);
    const justifications = justificationRows.map(j => ({
      alertType: j.alertType,
      status: j.status,
      deductionOutcome: WITH_DEDUCTION_STATUSES.has(j.status) ? 'WITH_DEDUCTION'
        : ['HR_APPROVED', 'MANAGER_APPROVED'].includes(j.status) ? 'NO_DEDUCTION'
        : 'PENDING',
      reason: j.descriptionAr,
      managerReviewedAt: j.managerReviewedAt,
      hrReviewedAt: j.hrReviewedAt,
    }));

    // 2) استهلاك الرصيد الساعي التلقائي (تعويض تأخير/انصراف مبكر من رصيد الساعتين الشهري)
    const autoHourlyLeaveRows = await this.prisma.$queryRawUnsafe(`
      SELECT source, "durationHours", status
      FROM leaves.leave_requests
      WHERE "employeeId" = $1 AND "startDate"::date = $2::date
        AND "isHourlyLeave" = true AND source IN ('TARDINESS_AUTO', 'EARLY_LEAVE_AUTO')
      ORDER BY "createdAt" ASC
    `, employeeId, dateStr) as Array<{ source: string; durationHours: number; status: string }>;

    // 3) إجازة ساعية يدوية (طلبها الموظف بنفسه) بوقتها بالضبط — تم جلبها مسبقاً بالأعلى
    // (manualHourlyLeaveRowsForDay) واستُخدمت لخصم التغطية من التأخير/الخروج المبكر الخام
    const manualHourlyLeaveRows = manualHourlyLeaveRowsForDay;

    // 4) طلب مهمة عمل (داخلية/خارجية) يشمل هذا اليوم
    const missionRequestRows = await this.prisma.$queryRawUnsafe(`
      SELECT id, status, details
      FROM requests.requests
      WHERE type = 'BUSINESS_MISSION' AND "deletedAt" IS NULL
        AND ("employeeId" = $1 OR (details->>'targetEmployeeId') = $1)
        AND (details->>'startDate')::date <= $2::date
        AND (details->>'endDate')::date >= $2::date
      ORDER BY "createdAt" ASC
    `, employeeId, dateStr) as Array<{ id: string; status: string; details: any }>;

    // 5) لو غايب: هل عندو طلب إجازة (أي حالة) بيشمل هذا اليوم؟ (يعني غياب فيه طلب لسا معلّق/غير معتمد)
    let absenceLeaveRequests: any[] = [];
    if ((record as any).status === 'ABSENT') {
      absenceLeaveRequests = await this.prisma.$queryRawUnsafe(`
        SELECT lr.id, lr.status, lr."startDate", lr."endDate", lt."nameAr" as "typeName"
        FROM leaves.leave_requests lr
        JOIN leaves.leave_types lt ON lt.id = lr."leaveTypeId"
        WHERE lr."employeeId" = $1
          AND lr."startDate"::date <= $2::date AND lr."endDate"::date >= $2::date
          AND lr."deletedAt" IS NULL
        ORDER BY lr."createdAt" DESC
      `, employeeId, dateStr);
    }

    return {
      date: dateStr,
      clockInTime: (record as any).clockInTime,
      clockOutTime: (record as any).clockOutTime,
      status: (record as any).status,
      lateMinutes: computedLateMinutes,
      earlyLeaveMinutes: computedEarlyLeaveMinutes,
      justifications,
      autoHourlyLeaveUsage: autoHourlyLeaveRows.map(r => ({
        type: r.source === 'TARDINESS_AUTO' ? 'LATE_COMPENSATION' : 'EARLY_LEAVE_COMPENSATION',
        minutes: Math.round(Number(r.durationHours) * 60),
        status: r.status,
      })),
      manualHourlyLeave: manualHourlyLeaveRows,
      halfDayLeavePeriod: halfDayPeriodForDay ?? null,
      businessMission: missionRequestRows.map(m => ({
        id: m.id, status: m.status,
        missionType: m.details?.missionType ?? null,
        startDate: m.details?.startDate ?? null,
        endDate: m.details?.endDate ?? null,
      })),
      absenceWithUnapprovedLeave: absenceLeaveRequests.filter((l: any) => l.status !== 'APPROVED'),
    };
  }

  async updateStampInterpretation(logId: string, interpretedAs: string, userId: string) {
    const valid = ['CLOCK_IN', 'CLOCK_OUT', 'BREAK_OUT', 'BREAK_IN', 'EXCLUDED'];
    if (!valid.includes(interpretedAs)) {
      throw new BadRequestException(`interpretedAs must be one of: ${valid.join(', ')}`);
    }

    const existing = (await this.prisma.$queryRawUnsafe(
      `SELECT id, "employeeId", timestamp FROM biometric.raw_attendance_logs WHERE id = $1 LIMIT 1`,
      logId,
    )) as Array<{ id: string; employeeId: string; timestamp: Date }>;

    if (!existing[0]) throw new NotFoundException('Raw stamp not found');

    await this.prisma.$queryRawUnsafe(
      `UPDATE biometric.raw_attendance_logs SET "interpretedAs" = $1 WHERE id = $2`,
      interpretedAs, logId,
    );

    await this.prisma.$queryRawUnsafe(
      `INSERT INTO attendance.attendance_computation_logs
         (id, "attendanceRecordId", "employeeId", date, action, source, "changedFields", "performedBy", notes, "createdAt")
       VALUES
         (gen_random_uuid(), NULL, $1, $2::date, 'STAMP_INTERPRETATION_UPDATED', 'HTTP', $3, $4, 'Manual stamp interpretation update', NOW())`,
      existing[0].employeeId,
      existing[0].timestamp.toISOString().split('T')[0],
      JSON.stringify({ interpretedAs: { to: interpretedAs } }),
      userId,
    ).catch(() => {});

    return { id: logId, interpretedAs };
  }

  async deleteStamp(logId: string, userId: string) {
    return this.updateStampInterpretation(logId, 'EXCLUDED', userId);
  }

  async recomputeRecord(recordId: string, userId: string) {
    const record = await this.findOne(recordId);
    const employeeId = (record as any).employeeId as string;
    const date: Date = (record as any).date;
    const dateStr = date.toISOString().split('T')[0];

    const dayStart = new Date(dateStr + 'T00:00:00Z');
    const dayEnd = new Date(dayStart.getTime() + 30 * 60 * 60 * 1000);

    const stamps = (await this.prisma.$queryRawUnsafe(
      `SELECT id, timestamp, "interpretedAs"
       FROM biometric.raw_attendance_logs
       WHERE "employeeId" = $1
         AND timestamp >= $2
         AND timestamp < $3
         AND "interpretedAs" != 'EXCLUDED'
       ORDER BY timestamp ASC`,
      employeeId, dayStart, dayEnd,
    )) as Array<{ id: string; timestamp: Date; interpretedAs: string }>;

    let clockInTime: Date | null = null;
    let clockOutTime: Date | null = null;
    let openBreakOut: Date | null = null;
    let totalBreakMinutes = 0;

    for (const s of stamps) {
      if (s.interpretedAs === 'CLOCK_IN' && !clockInTime) {
        clockInTime = s.timestamp;
      } else if (s.interpretedAs === 'CLOCK_OUT') {
        clockOutTime = s.timestamp;
      } else if (s.interpretedAs === 'BREAK_OUT') {
        openBreakOut = s.timestamp;
      } else if (s.interpretedAs === 'BREAK_IN' && openBreakOut) {
        totalBreakMinutes += Math.max(0, Math.round((s.timestamp.getTime() - openBreakOut.getTime()) / 60000));
        openBreakOut = null;
      }
    }

    const computed = await this.unifiedComputation.compute({
      employeeId,
      date,
      clockInTime,
      clockOutTime,
      totalBreakMinutes,
    });

    // الموظف غير المرتبط بالراتب: تأخير/خروج مبكر غير ذي معنى له
    const config = await this.prisma.employeeAttendanceConfig.findUnique({ where: { employeeId } });
    const salaryLinked = (record as any).salaryLinked ?? config?.salaryLinked ?? true;
    const status = salaryLinked ? computed.status : (['LATE', 'EARLY_LEAVE'].includes(computed.status) ? 'PRESENT' : computed.status);
    const lateMinutes = salaryLinked ? computed.lateMinutes : 0;
    const earlyLeaveMinutes = salaryLinked ? computed.earlyLeaveMinutes : 0;

    const punchSequenceStatus = !clockOutTime ? 'PARTIAL' : 'VALID';

    await this.prisma.$queryRawUnsafe(
      `UPDATE attendance.attendance_records SET
         "clockInTime" = $1, "clockOutTime" = $2,
         "workedMinutes" = $3, "netWorkedMinutes" = $4,
         "lateMinutes" = $5, "earlyLeaveMinutes" = $6,
         "overtimeMinutes" = $7, "lateCompensatedMinutes" = $8,
         "totalBreakMinutes" = $9, status = $10,
         "punchSequenceStatus" = $11,
         "tardinessPendingDeductionMinutes" = 0,
         "earlyLeavePendingDeductionMinutes" = 0,
         "updatedAt" = NOW()
       WHERE id = $12`,
      clockInTime, clockOutTime,
      computed.workedMinutes, computed.netWorkedMinutes,
      lateMinutes, earlyLeaveMinutes,
      computed.overtimeMinutes, computed.lateCompensatedMinutes,
      totalBreakMinutes, status, punchSequenceStatus,
      recordId,
    );

    await this.prisma.$queryRawUnsafe(
      `INSERT INTO attendance.attendance_computation_logs
         (id, "attendanceRecordId", "employeeId", date, action, source, "changedFields", "performedBy", notes, "createdAt")
       VALUES
         (gen_random_uuid(), $1, $2, $3::date, 'MANUAL_RECOMPUTE', 'HTTP', $4, $5, 'Manual recompute after stamp correction', NOW())`,
      recordId, employeeId, dateStr,
      JSON.stringify({ status: computed.status, lateMinutes: computed.lateMinutes, punchSequenceStatus }),
      userId,
    ).catch(() => {});

    return this.findOne(recordId);
  }

  async getNeedsReview(query: { employeeId?: string; dateFrom?: string; dateTo?: string; page?: number | string; limit?: number | string }) {
    const conditions: string[] = [`"punchSequenceStatus" = 'NEEDS_REVIEW'`];
    const params: unknown[] = [];
    let idx = 1;

    if (query.employeeId) {
      conditions.push(`"employeeId" = $${idx++}`);
      params.push(query.employeeId);
    }
    if (query.dateFrom) {
      conditions.push(`date >= $${idx++}::date`);
      params.push(query.dateFrom);
    }
    if (query.dateTo) {
      conditions.push(`date <= $${idx++}::date`);
      params.push(query.dateTo);
    }

    const where = conditions.join(' AND ');
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRawUnsafe(
        `SELECT * FROM attendance.attendance_records WHERE ${where} ORDER BY date DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        ...params, limit, offset,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS total FROM attendance.attendance_records WHERE ${where}`,
        ...params,
      ),
    ]);

    const items = rows as any[];
    const total = (countRows as Array<{ total: number }>)[0]?.total ?? 0;
    const employeeIds = [...new Set(items.map(r => r.employeeId))] as string[];
    const employeeMap = await this.getEmployeeNames(employeeIds);

    return {
      items: items.map(r => ({ ...r, employee: employeeMap.get(r.employeeId) || null })),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async addManualStamp(recordId: string, body: { timestamp: string; interpretedAs: string; deviceId?: string }, userId: string) {
    const valid = ['CLOCK_IN', 'CLOCK_OUT', 'BREAK_OUT', 'BREAK_IN'];
    if (!valid.includes(body.interpretedAs)) {
      throw new BadRequestException(`interpretedAs must be one of: ${valid.join(', ')}`);
    }

    const record = await this.findOne(recordId);
    const employeeId = (record as any).employeeId as string;
    const ts = new Date(body.timestamp);

    if (isNaN(ts.getTime())) {
      throw new BadRequestException('Invalid timestamp');
    }

    // جلب الجهاز المحدد أو أول جهاز نشط
    const deviceQuery = body.deviceId
      ? `SELECT id, "serialNumber" FROM biometric.biometric_devices WHERE id = '${body.deviceId}' AND "isActive" = true LIMIT 1`
      : `SELECT id, "serialNumber" FROM biometric.biometric_devices WHERE "isActive" = true LIMIT 1`;
    const devices = (await this.prisma.$queryRawUnsafe(deviceQuery)) as Array<{ id: string; serialNumber: string }>;

    if (!devices[0]) {
      throw new BadRequestException(
        body.deviceId
          ? 'الجهاز المحدد غير موجود أو غير نشط'
          : 'No active biometric device found — cannot create manual stamp',
      );
    }

    const deviceId = devices[0].id;
    const deviceSN = devices[0].serialNumber;

    await this.prisma.$queryRawUnsafe(
      `INSERT INTO biometric.raw_attendance_logs
         (id, "deviceId", "deviceSN", pin, "employeeId", timestamp, "rawType", "interpretedAs", "synced", "createdAt")
       VALUES
         (gen_random_uuid(), $1, $2, '0', $3, $4, 0, $5, false, NOW())`,
      deviceId, deviceSN, employeeId, ts, body.interpretedAs,
    );

    await this.prisma.$queryRawUnsafe(
      `INSERT INTO attendance.attendance_computation_logs
         (id, "attendanceRecordId", "employeeId", date, action, source, "changedFields", "performedBy", notes, "createdAt")
       VALUES
         (gen_random_uuid(), $1, $2, $3::date, 'MANUAL_STAMP_ADDED', 'HTTP', $4, $5, 'Manual stamp added by HR', NOW())`,
      recordId, employeeId,
      ts.toISOString().split('T')[0],
      JSON.stringify({ timestamp: ts, interpretedAs: body.interpretedAs }),
      userId,
    ).catch(() => {});

    return this.recomputeRecord(recordId, userId);
  }

  async approveRecord(recordId: string, userId: string) {
    const record = await this.findOne(recordId);
    const employeeId = (record as any).employeeId as string;
    const dateStr = ((record as any).date as Date).toISOString().split('T')[0];

    await this.prisma.$queryRawUnsafe(
      `UPDATE attendance.attendance_records
       SET "punchSequenceStatus" = 'VALID', "updatedAt" = NOW()
       WHERE id = $1`,
      recordId,
    );

    await this.prisma.$queryRawUnsafe(
      `INSERT INTO attendance.attendance_computation_logs
         (id, "attendanceRecordId", "employeeId", date, action, source, "changedFields", "performedBy", notes, "createdAt")
       VALUES
         (gen_random_uuid(), $1, $2, $3::date, 'RECORD_APPROVED', 'HTTP', NULL, $4, 'Record manually approved by HR', NOW())`,
      recordId, employeeId, dateStr, userId,
    ).catch(() => {});

    return this.findOne(recordId);
  }
}
