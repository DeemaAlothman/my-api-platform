/**
 * seed-demo.ts — بيانات تجريبية للحضور والرواتب
 * مترابطة مع موظفي users/seed-demo.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EMP = {
  sarah:  'e0000001-0000-0000-0000-000000000000',
  khalid: 'e0000002-0000-0000-0000-000000000000',
  fatima: 'e0000003-0000-0000-0000-000000000000',
  omar:   'e0000004-0000-0000-0000-000000000000',
  nora:   'e0000005-0000-0000-0000-000000000000',
};

const SCHEDULE_ID = 'ws000001-0000-0000-0000-000000000000';
const POLICY_ID   = 'dp000001-0000-0000-0000-000000000000';

async function main() {
  console.log('🌱 Seeding demo attendance data...');

  // ===== 1. إعدادات الحضور =====
  const settings = [
    { key: 'LATE_TOLERANCE_MINUTES', value: '15',  description: 'دقائق السماح للتأخير' },
    { key: 'ABSENT_AFTER_HOURS',     value: '4',   description: 'ساعات الغياب الكامل' },
    { key: 'OVERTIME_START_AFTER',   value: '30',  description: 'بداية الأوفر تايم بعد نهاية الدوام (دقيقة)' },
    { key: 'MAX_BREAK_MINUTES',      value: '60',  description: 'الحد الأقصى للاستراحة' },
  ];
  for (const s of settings) {
    await (prisma as any).attendanceSetting.upsert({
      where: { key: s.key }, update: {}, create: s,
    }).catch(() => {});
  }
  console.log('✅ Attendance settings');

  // ===== 2. سياسة الحسميات الافتراضية =====
  await (prisma as any).deductionPolicy.upsert({
    where: { id: POLICY_ID },
    update: {},
    create: {
      id: POLICY_ID,
      nameAr: 'السياسة الافتراضية',
      nameEn: 'Default Policy',
      isDefault: true,
      lateToleranceMinutes: 15,
      lateDeductionType: 'MINUTE_BY_MINUTE',
      earlyLeaveDeductionType: 'MINUTE_BY_MINUTE',
      absenceDeductionDays: 1.0,
      repeatLateThreshold: 3,
      repeatLatePenaltyDays: 0.5,
      breakOverLimitDeduction: 'MINUTE_BY_MINUTE',
      isActive: true,
    },
  }).catch(() => {});
  console.log('✅ Deduction policy (default)');

  // ===== 3. جدول الدوام =====
  await (prisma as any).workSchedule.upsert({
    where: { id: SCHEDULE_ID },
    update: {},
    create: {
      id: SCHEDULE_ID,
      code: 'OFFICIAL',
      nameAr: 'الدوام الرسمي',
      nameEn: 'Official Hours',
      workDays: JSON.stringify([0, 1, 2, 3, 4]),
      workStartTime: '08:00',
      workEndTime: '16:00',
      lateToleranceMin: 15,
      earlyLeaveToleranceMin: 15,
      allowOvertime: false,
      isDefault: true,
      isActive: true,
    },
  }).catch(() => {});
  console.log('✅ Work schedule');

  // ===== 4. ربط الموظفين بالجدول =====
  for (const empId of Object.values(EMP)) {
    await (prisma as any).employeeSchedule.upsert({
      where: {
        employeeId_scheduleId_effectiveFrom: {
          employeeId: empId,
          scheduleId: SCHEDULE_ID,
          effectiveFrom: new Date('2026-01-01'),
        },
      },
      update: {},
      create: {
        employeeId: empId,
        scheduleId: SCHEDULE_ID,
        effectiveFrom: new Date('2026-01-01'),
        isActive: true,
      },
    }).catch(() => {});
  }
  console.log('✅ Employee schedules');

  // ===== 5. سجلات الحضور — أسبوعان (6-10 و 13-17 أبريل) =====
  const days = [
    '2026-04-06', '2026-04-07', '2026-04-08', '2026-04-09', '2026-04-10',
    '2026-04-13', '2026-04-14', '2026-04-15', '2026-04-16', '2026-04-17',
  ];

  // أنماط الحضور لكل موظف
  const patterns: { id: string; lateMin: number; earlyMin: number }[] = [
    { id: EMP.sarah,  lateMin: 0,  earlyMin: 0  }, // ملتزمة
    { id: EMP.khalid, lateMin: 0,  earlyMin: 0  }, // ملتزم
    { id: EMP.fatima, lateMin: 8,  earlyMin: 0  }, // تأخير خفيف (ضمن السماح)
    { id: EMP.omar,   lateMin: 20, earlyMin: 0  }, // تأخير فعلي (5 دقائق بعد السماح)
    { id: EMP.nora,   lateMin: 0,  earlyMin: 10 }, // خروج مبكر
  ];

  for (const emp of patterns) {
    for (const dateStr of days) {
      const day = new Date(dateStr);
      const clockIn  = new Date(`${dateStr}T${
        String(8 + Math.floor(emp.lateMin / 60)).padStart(2,'0')
      }:${String(emp.lateMin % 60).padStart(2,'0')}:00Z`);
      const clockOut = new Date(`${dateStr}T${
        String(16 - Math.floor(emp.earlyMin / 60)).padStart(2,'0')
      }:${String(60 - (emp.earlyMin % 60 || 60) === 60 ? 0 : 60 - (emp.earlyMin % 60)).padStart(2,'0')}:00Z`);
      const worked = Math.round((clockOut.getTime() - clockIn.getTime()) / 60000);

      await (prisma as any).attendanceRecord.upsert({
        where: { employeeId_date: { employeeId: emp.id, date: day } },
        update: {},
        create: {
          employeeId: emp.id,
          date: day,
          clockInTime: clockIn,
          clockOutTime: clockOut,
          status: emp.lateMin > 15 ? 'LATE' : 'PRESENT',
          workedMinutes: worked,
          lateMinutes: Math.max(0, emp.lateMin - 15),
          earlyLeaveMinutes: emp.earlyMin,
          source: 'MANUAL',
          isManualEntry: true,
          salaryLinked: true,
        },
      }).catch(() => {});
    }
  }

  // يوم غياب لعمر (9 أبريل) — يتجاوز السجل العادي
  await (prisma as any).attendanceRecord.upsert({
    where: { employeeId_date: { employeeId: EMP.omar, date: new Date('2026-04-09') } },
    update: { status: 'ABSENT', clockInTime: null, clockOutTime: null, workedMinutes: 0, lateMinutes: 0 },
    create: {
      employeeId: EMP.omar,
      date: new Date('2026-04-09'),
      status: 'ABSENT',
      workedMinutes: 0,
      lateMinutes: 0,
      source: 'MANUAL',
      salaryLinked: true,
    },
  }).catch(() => {});

  console.log('✅ Attendance records (5 employees × 10 days)');

  // ===== 6. تنبيه غياب عمر =====
  await (prisma as any).attendanceAlert.upsert({
    where: { id: 'al000001-0000-0000-0000-000000000000' },
    update: {},
    create: {
      id: 'al000001-0000-0000-0000-000000000000',
      employeeId: EMP.omar,
      date: new Date('2026-04-09'),
      alertType: 'ABSENT',
      severity: 'HIGH',
      message: 'Employee was absent on 2026-04-09',
      messageAr: 'الموظف غائب بتاريخ 2026-04-09',
      status: 'OPEN',
      isAutoGenerated: true,
    },
  }).catch(() => {});
  console.log('✅ Attendance alert (Omar absent)');

  // ===== 7. كشوف الرواتب — أبريل 2026 =====
  const salaries: Record<string, { basic: number; allowances: number }> = {
    [EMP.sarah]:  { basic: 10000, allowances: 0    },
    [EMP.khalid]: { basic: 15000, allowances: 0    },
    [EMP.fatima]: { basic: 6000,  allowances: 300  },
    [EMP.omar]:   { basic: 7500,  allowances: 0    },
    [EMP.nora]:   { basic: 8000,  allowances: 1400 },
  };

  const payrollInput = [
    { empId: EMP.sarah,  lateMin: 0,  absentDays: 0, earlyMin: 0  },
    { empId: EMP.khalid, lateMin: 0,  absentDays: 0, earlyMin: 0  },
    { empId: EMP.fatima, lateMin: 0,  absentDays: 0, earlyMin: 0  }, // تأخير ضمن السماح → بدون خصم
    { empId: EMP.omar,   lateMin: 50, absentDays: 1, earlyMin: 0  }, // 10 أيام × 5 دقائق خصم
    { empId: EMP.nora,   lateMin: 0,  absentDays: 0, earlyMin: 100 }, // 10 أيام × 10 دقائق خروج مبكر
  ];

  for (const p of payrollInput) {
    const { basic, allowances } = salaries[p.empId];
    const dailyRate    = basic / 22;
    const minuteRate   = dailyRate / 480;
    const lateDeduct   = p.lateMin * minuteRate;
    const earlyDeduct  = p.earlyMin * minuteRate;
    const absDeduct    = p.absentDays * dailyRate;
    const totalDeduct  = lateDeduct + earlyDeduct + absDeduct;
    const gross        = basic + allowances;
    const net          = gross - totalDeduct;

    await (prisma as any).monthlyPayroll.upsert({
      where: { employeeId_year_month: { employeeId: p.empId, year: 2026, month: 4 } },
      update: {},
      create: {
        employeeId: p.empId,
        year: 2026,
        month: 4,
        policyId: POLICY_ID,
        workingDays: 22,
        presentDays: 22 - p.absentDays,
        absentDays: p.absentDays,
        absentUnjustified: p.absentDays,
        lateDays: p.lateMin > 0 ? 10 : 0,
        totalLateMinutes: p.lateMin,
        earlyLeaveDays: p.earlyMin > 0 ? 10 : 0,
        totalEarlyLeaveMinutes: p.earlyMin,
        breakOverLimitMinutes: 0,
        overtimeMinutes: 0,
        totalWorkedMinutes: (22 - p.absentDays) * 480,
        netWorkedMinutes: (22 - p.absentDays) * 480 - p.lateMin - p.earlyMin,
        lateDeductionMinutes: p.lateMin,
        earlyLeaveDeductionMinutes: p.earlyMin,
        absenceDeductionDays: p.absentDays,
        totalDeductionMinutes: p.lateMin + p.earlyMin,
        basicSalary: basic,
        allowancesTotal: allowances,
        deductionAmount: parseFloat(totalDeduct.toFixed(2)),
        absenceDeductionAmount: parseFloat(absDeduct.toFixed(2)),
        grossSalary: gross,
        netSalary: parseFloat(net.toFixed(2)),
        currency: 'SAR',
        dailyRate: parseFloat(dailyRate.toFixed(2)),
        minuteRate: parseFloat(minuteRate.toFixed(4)),
        salaryLinked: true,
        status: 'DRAFT',
      },
    }).catch(() => {});
  }
  console.log('✅ Monthly payrolls — April 2026');
  console.log('🎉 Attendance demo seed completed!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
