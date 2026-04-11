/**
 * seed-demo.ts — بيانات تجريبية لأجهزة البصمة
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEVICE_ID = 'dev00001-0000-0000-0000-000000000000';

// نفس IDs من users/seed-demo.ts
const EMP = {
  sarah:  { id: 'e0000001-0000-0000-0000-000000000000', pin: '1001' },
  khalid: { id: 'e0000002-0000-0000-0000-000000000000', pin: '1002' },
  fatima: { id: 'e0000003-0000-0000-0000-000000000000', pin: '1003' },
  omar:   { id: 'e0000004-0000-0000-0000-000000000000', pin: '1004' },
  nora:   { id: 'e0000005-0000-0000-0000-000000000000', pin: '1005' },
};

async function main() {
  console.log('🌱 Seeding demo ZKTeco data...');

  // ===== جهاز البصمة التجريبي =====
  await (prisma as any).biometricDevice.upsert({
    where: { id: DEVICE_ID },
    update: {},
    create: {
      id: DEVICE_ID,
      serialNumber: 'DEMO-ZK-001',
      nameAr: 'جهاز البصمة - المدخل الرئيسي',
      nameEn: 'Main Entrance Device',
      location: 'المدخل الرئيسي',
      ipAddress: '192.168.1.100',
      model: 'ZKTeco K40',
      isActive: true,
      lastSyncAt: new Date('2026-04-10T16:00:00Z'),
    },
  });

  console.log('✅ Biometric device (DEMO-ZK-001)');

  // ===== ربط بصمات الموظفين بالجهاز =====
  for (const [name, emp] of Object.entries(EMP)) {
    await (prisma as any).employeeFingerprint.upsert({
      where: { pin_deviceId: { pin: emp.pin, deviceId: DEVICE_ID } },
      update: {},
      create: {
        employeeId: emp.id,
        pin: emp.pin,
        deviceId: DEVICE_ID,
        isActive: true,
      },
    }).catch(() => {});
  }

  console.log('✅ Employee fingerprints (5 employees linked, PINs: 1001-1005)');

  // ===== سجلات خام تجريبية (يوم 2026-04-10) =====
  const logs = [
    // دخول وخروج لكل موظف
    { pin: '1001', timestamp: new Date('2026-04-10T08:03:00Z'), rawType: 0, employeeId: EMP.sarah.id },
    { pin: '1001', timestamp: new Date('2026-04-10T16:12:00Z'), rawType: 1, employeeId: EMP.sarah.id },
    { pin: '1002', timestamp: new Date('2026-04-10T07:58:00Z'), rawType: 0, employeeId: EMP.khalid.id },
    { pin: '1002', timestamp: new Date('2026-04-10T16:05:00Z'), rawType: 1, employeeId: EMP.khalid.id },
    { pin: '1003', timestamp: new Date('2026-04-10T08:10:00Z'), rawType: 0, employeeId: EMP.fatima.id },
    { pin: '1003', timestamp: new Date('2026-04-10T16:15:00Z'), rawType: 1, employeeId: EMP.fatima.id },
    // عمر غياب — ما في سجل
    { pin: '1005', timestamp: new Date('2026-04-10T08:06:00Z'), rawType: 0, employeeId: EMP.nora.id },
    { pin: '1005', timestamp: new Date('2026-04-10T16:08:00Z'), rawType: 1, employeeId: EMP.nora.id },
  ];

  for (const log of logs) {
    await (prisma as any).rawAttendanceLog.create({
      data: {
        deviceId: DEVICE_ID,
        deviceSN: 'DEMO-ZK-001',
        pin: log.pin,
        employeeId: log.employeeId,
        timestamp: log.timestamp,
        rawType: log.rawType,
        interpretedAs: log.rawType === 0 ? 'CHECK_IN' : 'CHECK_OUT',
        synced: true,
        syncedAt: new Date('2026-04-10T17:00:00Z'),
      },
    }).catch(() => {});
  }

  console.log('✅ Raw attendance logs (8 records for 2026-04-10, Omar absent)');
  console.log('🎉 ZKTeco demo seed completed!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
