import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// workDays: [0,1,2,3,4] = الأحد-الخميس (يُعدَّل بعد تأكيد المدير)
const shifts = [
  {
    code: 'MAIN_10_18',
    nameAr: 'الوردية الأساسية (10 - 6)',
    nameEn: 'Main Shift 10:00-18:00',
    workStartTime: '10:00',
    workEndTime: '18:00',
    breakDurationMin: 60,
    workDays: '[0,1,2,3,4]',
    lateToleranceMin: 15,
    earlyLeaveToleranceMin: 0,
    allowOvertime: true,
    maxOvertimeHours: 4,
    shiftType: 'DAY',
    minimumWorkMinutes: null,
    requiresContinuousWork: false,
    isActive: true,
  },
  {
    code: 'SECOND_9_16',
    nameAr: 'الوردية الثانية (9 - 4)',
    nameEn: 'Second Shift 09:00-16:00',
    workStartTime: '09:00',
    workEndTime: '16:00',
    breakDurationMin: 60,
    workDays: '[0,1,2,3,4]',
    lateToleranceMin: 15,
    earlyLeaveToleranceMin: 0,
    allowOvertime: true,
    maxOvertimeHours: 4,
    shiftType: 'DAY',
    minimumWorkMinutes: null,
    requiresContinuousWork: false,
    isActive: true,
  },
  {
    code: 'ACCOUNTANT_FLEXIBLE',
    nameAr: 'وردية المحاسب (3 ساعات متواصلة)',
    nameEn: 'Accountant Flexible Shift',
    workStartTime: '10:00',
    workEndTime: '13:00',
    breakDurationMin: 0,
    workDays: '[0,1,2,3,4]',
    lateToleranceMin: 15,
    earlyLeaveToleranceMin: 0,
    allowOvertime: false,
    maxOvertimeHours: 0,
    shiftType: 'FLEXIBLE',
    minimumWorkMinutes: 180,
    requiresContinuousWork: true,
    isActive: true,
  },
  {
    code: 'FOURTH_930_1630',
    nameAr: 'الوردية الرابعة (9:30 - 4:30)',
    nameEn: 'Fourth Shift 09:30-16:30',
    workStartTime: '09:30',
    workEndTime: '16:30',
    breakDurationMin: 60,
    workDays: '[0,1,2,3,4]',
    lateToleranceMin: 15,
    earlyLeaveToleranceMin: 0,
    allowOvertime: true,
    maxOvertimeHours: 4,
    shiftType: 'DAY',
    minimumWorkMinutes: null,
    requiresContinuousWork: false,
    isActive: true,
  },
];

async function main() {
  console.log('Seeding business rule shifts...');

  for (const shift of shifts) {
    await (prisma as any).workSchedule.upsert({
      where: { code: shift.code },
      update: shift,
      create: shift,
    });
    console.log(`  upserted: ${shift.code}`);
  }

  console.log('Done.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
