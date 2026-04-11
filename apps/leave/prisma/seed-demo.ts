/**
 * seed-demo.ts — بيانات تجريبية للإجازات
 * يفترض إن users seed-demo شغّل قبله
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// نفس IDs من users/seed-demo.ts
const EMP = {
  admin:  null, // سنجلبه من DB
  sarah:  'e0000001-0000-0000-0000-000000000000',
  khalid: 'e0000002-0000-0000-0000-000000000000',
  fatima: 'e0000003-0000-0000-0000-000000000000',
  omar:   'e0000004-0000-0000-0000-000000000000',
  nora:   'e0000005-0000-0000-0000-000000000000',
};

async function main() {
  console.log('🌱 Seeding demo leave data...');

  // جيب أنواع الإجازات من DB
  const annual    = await prisma.leaveType.findUnique({ where: { code: 'ANNUAL' } });
  const sick      = await prisma.leaveType.findUnique({ where: { code: 'SICK' } });
  const emergency = await prisma.leaveType.findUnique({ where: { code: 'EMERGENCY' } });

  if (!annual || !sick || !emergency) {
    console.error('❌ Run the base leave seed first (npx tsx prisma/seed.ts)');
    return;
  }

  const year = 2026;
  const employees = [EMP.sarah, EMP.khalid, EMP.fatima, EMP.omar, EMP.nora];

  // ===== أرصدة الإجازات =====
  for (const empId of employees) {
    if (!empId) continue;

    // رصيد سنوي
    await prisma.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId: empId, leaveTypeId: annual.id, year } },
      update: {},
      create: { employeeId: empId, leaveTypeId: annual.id, year, totalDays: 21, usedDays: 0, pendingDays: 0, remainingDays: 21 },
    });

    // رصيد مرضي
    await prisma.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId: empId, leaveTypeId: sick.id, year } },
      update: {},
      create: { employeeId: empId, leaveTypeId: sick.id, year, totalDays: 15, usedDays: 0, pendingDays: 0, remainingDays: 15 },
    });
  }
  console.log('✅ Leave balances (annual + sick for 5 employees)');

  // ===== طلبات إجازة تجريبية =====

  // فاطمة — طلب سنوي مقبول
  const req1 = await prisma.leaveRequest.upsert({
    where: { id: 'f0000001-0000-0000-0000-000000000000' },
    update: {},
    create: {
      id: 'f0000001-0000-0000-0000-000000000000',
      employeeId: EMP.fatima,
      leaveTypeId: annual.id,
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-07'),
      totalDays: 7,
      reason: 'إجازة سنوية مخططة',
      status: 'APPROVED',
      submittedAt: new Date('2026-04-15'),
    },
  });

  // عمر — طلب سنوي قيد الانتظار
  await prisma.leaveRequest.upsert({
    where: { id: 'f0000002-0000-0000-0000-000000000000' },
    update: {},
    create: {
      id: 'f0000002-0000-0000-0000-000000000000',
      employeeId: EMP.omar,
      leaveTypeId: annual.id,
      startDate: new Date('2026-06-10'),
      endDate: new Date('2026-06-14'),
      totalDays: 5,
      reason: 'رحلة عائلية',
      status: 'PENDING',
      submittedAt: new Date('2026-04-10'),
    },
  });

  // نورة — طلب مرضي مرفوض
  await prisma.leaveRequest.upsert({
    where: { id: 'f0000003-0000-0000-0000-000000000000' },
    update: {},
    create: {
      id: 'f0000003-0000-0000-0000-000000000000',
      employeeId: EMP.nora,
      leaveTypeId: sick.id,
      startDate: new Date('2026-03-20'),
      endDate: new Date('2026-03-22'),
      totalDays: 3,
      reason: 'مراجعة طبية',
      status: 'REJECTED',
      submittedAt: new Date('2026-03-18'),
    },
  });

  // خالد — طلب طارئ مقبول
  await prisma.leaveRequest.upsert({
    where: { id: 'f0000004-0000-0000-0000-000000000000' },
    update: {},
    create: {
      id: 'f0000004-0000-0000-0000-000000000000',
      employeeId: EMP.khalid,
      leaveTypeId: emergency.id,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-02'),
      totalDays: 2,
      reason: 'ظرف طارئ',
      status: 'APPROVED',
      submittedAt: new Date('2026-04-01'),
    },
  });

  console.log('✅ Leave requests (4 requests: approved/pending/rejected)');
  console.log('🎉 Leave demo seed completed!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
