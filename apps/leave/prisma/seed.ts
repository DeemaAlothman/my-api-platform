import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // إنشاء أنواع الإجازات الافتراضية
  console.log('Creating leave types...');

  const leaveTypes = [
    {
      code: 'ANNUAL',
      nameAr: 'إجازة سنوية',
      nameEn: 'Annual Leave',
      defaultDays: 21,
      isPaid: true,
      requiresApproval: true,
      requiresAttachment: false,
      maxDaysPerRequest: 30,
      minDaysNotice: 3,
      allowHalfDay: true,
      color: '#4CAF50',
      isActive: true,
    },
    {
      code: 'SICK',
      nameAr: 'إجازة مرضية',
      nameEn: 'Sick Leave',
      defaultDays: 15,
      isPaid: true,
      requiresApproval: true,
      requiresAttachment: true,
      maxDaysPerRequest: 10,
      minDaysNotice: 0,
      allowHalfDay: false,
      color: '#FF9800',
      isActive: true,
    },
    {
      code: 'EMERGENCY',
      nameAr: 'إجازة طارئة',
      nameEn: 'Emergency Leave',
      defaultDays: 5,
      isPaid: true,
      requiresApproval: true,
      requiresAttachment: false,
      maxDaysPerRequest: 3,
      minDaysNotice: 0,
      allowHalfDay: false,
      color: '#F44336',
      isActive: true,
    },
    {
      code: 'MATERNITY',
      nameAr: 'إجازة أمومة',
      nameEn: 'Maternity Leave',
      defaultDays: 70,
      isPaid: true,
      requiresApproval: true,
      requiresAttachment: true,
      maxDaysPerRequest: 70,
      minDaysNotice: 30,
      allowHalfDay: false,
      color: '#E91E63',
      isActive: true,
    },
    {
      code: 'PATERNITY',
      nameAr: 'إجازة أبوة',
      nameEn: 'Paternity Leave',
      defaultDays: 3,
      isPaid: true,
      requiresApproval: true,
      requiresAttachment: true,
      maxDaysPerRequest: 3,
      minDaysNotice: 7,
      allowHalfDay: false,
      color: '#2196F3',
      isActive: true,
    },
    {
      code: 'MARRIAGE',
      nameAr: 'إجازة زواج',
      nameEn: 'Marriage Leave',
      defaultDays: 5,
      isPaid: true,
      requiresApproval: true,
      requiresAttachment: true,
      maxDaysPerRequest: 5,
      minDaysNotice: 14,
      allowHalfDay: false,
      color: '#9C27B0',
      isActive: true,
    },
    {
      code: 'BEREAVEMENT',
      nameAr: 'إجازة وفاة',
      nameEn: 'Bereavement Leave',
      defaultDays: 3,
      isPaid: true,
      requiresApproval: true,
      requiresAttachment: true,
      maxDaysPerRequest: 3,
      minDaysNotice: 0,
      allowHalfDay: false,
      color: '#607D8B',
      isActive: true,
    },
    {
      code: 'STUDY',
      nameAr: 'إجازة دراسية',
      nameEn: 'Study Leave',
      defaultDays: 10,
      isPaid: false,
      requiresApproval: true,
      requiresAttachment: true,
      maxDaysPerRequest: 10,
      minDaysNotice: 30,
      allowHalfDay: false,
      color: '#00BCD4',
      isActive: true,
    },
    {
      code: 'UNPAID',
      nameAr: 'إجازة بدون راتب',
      nameEn: 'Unpaid Leave',
      defaultDays: 0,
      isPaid: false,
      requiresApproval: true,
      requiresAttachment: false,
      maxDaysPerRequest: 30,
      minDaysNotice: 7,
      allowHalfDay: false,
      color: '#9E9E9E',
      isActive: true,
    },
    {
      code: 'HAJJ',
      nameAr: 'إجازة حج',
      nameEn: 'Hajj Leave',
      defaultDays: 10,
      isPaid: true,
      requiresApproval: true,
      requiresAttachment: true,
      maxDaysPerRequest: 10,
      minDaysNotice: 60,
      allowHalfDay: false,
      color: '#795548',
      isActive: true,
    },
  ];

  for (const leaveType of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { code: leaveType.code },
      update: leaveType,
      create: leaveType,
    });
  }

  console.log(`Created ${leaveTypes.length} leave types`);

  // إنشاء العطل الرسمية لعام 2024
  console.log('Creating holidays for 2024...');

  const holidays2024 = [
    {
      nameAr: 'رأس السنة الميلادية',
      nameEn: 'New Year',
      date: new Date('2024-01-01'),
      type: 'PUBLIC',
      isRecurring: true,
      year: 2024,
    },
    {
      nameAr: 'عيد الفطر',
      nameEn: 'Eid Al-Fitr',
      date: new Date('2024-04-10'),
      endDate: new Date('2024-04-13'),
      type: 'RELIGIOUS',
      isRecurring: false,
      year: 2024,
    },
    {
      nameAr: 'عيد الأضحى',
      nameEn: 'Eid Al-Adha',
      date: new Date('2024-06-15'),
      endDate: new Date('2024-06-19'),
      type: 'RELIGIOUS',
      isRecurring: false,
      year: 2024,
    },
    {
      nameAr: 'رأس السنة الهجرية',
      nameEn: 'Islamic New Year',
      date: new Date('2024-07-07'),
      type: 'RELIGIOUS',
      isRecurring: false,
      year: 2024,
    },
    {
      nameAr: 'المولد النبوي الشريف',
      nameEn: 'Prophet\'s Birthday',
      date: new Date('2024-09-15'),
      type: 'RELIGIOUS',
      isRecurring: false,
      year: 2024,
    },
    {
      nameAr: 'اليوم الوطني',
      nameEn: 'National Day',
      date: new Date('2024-09-23'),
      type: 'NATIONAL',
      isRecurring: true,
      year: 2024,
    },
  ];

  for (const holiday of holidays2024) {
    await prisma.holiday.create({
      data: holiday,
    });
  }

  console.log(`Created ${holidays2024.length} holidays for 2024`);

  // إنشاء العطل الرسمية لعام 2025
  console.log('Creating holidays for 2025...');

  const holidays2025 = [
    {
      nameAr: 'رأس السنة الميلادية',
      nameEn: 'New Year',
      date: new Date('2025-01-01'),
      type: 'PUBLIC',
      isRecurring: true,
      year: 2025,
    },
    {
      nameAr: 'عيد الفطر',
      nameEn: 'Eid Al-Fitr',
      date: new Date('2025-03-30'),
      endDate: new Date('2025-04-02'),
      type: 'RELIGIOUS',
      isRecurring: false,
      year: 2025,
    },
    {
      nameAr: 'عيد الأضحى',
      nameEn: 'Eid Al-Adha',
      date: new Date('2025-06-06'),
      endDate: new Date('2025-06-10'),
      type: 'RELIGIOUS',
      isRecurring: false,
      year: 2025,
    },
    {
      nameAr: 'رأس السنة الهجرية',
      nameEn: 'Islamic New Year',
      date: new Date('2025-06-26'),
      type: 'RELIGIOUS',
      isRecurring: false,
      year: 2025,
    },
    {
      nameAr: 'المولد النبوي الشريف',
      nameEn: 'Prophet\'s Birthday',
      date: new Date('2025-09-04'),
      type: 'RELIGIOUS',
      isRecurring: false,
      year: 2025,
    },
    {
      nameAr: 'اليوم الوطني',
      nameEn: 'National Day',
      date: new Date('2025-09-23'),
      type: 'NATIONAL',
      isRecurring: true,
      year: 2025,
    },
  ];

  for (const holiday of holidays2025) {
    await prisma.holiday.create({
      data: holiday,
    });
  }

  console.log(`Created ${holidays2025.length} holidays for 2025`);

  // إنشاء العطل الرسمية لعام 2026
  console.log('Creating holidays for 2026...');

  const holidays2026 = [
    {
      nameAr: 'رأس السنة الميلادية',
      nameEn: 'New Year',
      date: new Date('2026-01-01'),
      type: 'PUBLIC',
      isRecurring: true,
      year: 2026,
    },
    {
      nameAr: 'عيد الفطر',
      nameEn: 'Eid Al-Fitr',
      date: new Date('2026-03-20'),
      endDate: new Date('2026-03-23'),
      type: 'RELIGIOUS',
      isRecurring: false,
      year: 2026,
    },
    {
      nameAr: 'عيد الأضحى',
      nameEn: 'Eid Al-Adha',
      date: new Date('2026-05-27'),
      endDate: new Date('2026-05-31'),
      type: 'RELIGIOUS',
      isRecurring: false,
      year: 2026,
    },
    {
      nameAr: 'رأس السنة الهجرية',
      nameEn: 'Islamic New Year',
      date: new Date('2026-06-16'),
      type: 'RELIGIOUS',
      isRecurring: false,
      year: 2026,
    },
    {
      nameAr: 'المولد النبوي الشريف',
      nameEn: 'Prophet\'s Birthday',
      date: new Date('2026-08-25'),
      type: 'RELIGIOUS',
      isRecurring: false,
      year: 2026,
    },
    {
      nameAr: 'اليوم الوطني',
      nameEn: 'National Day',
      date: new Date('2026-09-23'),
      type: 'NATIONAL',
      isRecurring: true,
      year: 2026,
    },
  ];

  for (const holiday of holidays2026) {
    await prisma.holiday.create({
      data: holiday,
    });
  }

  console.log(`Created ${holidays2026.length} holidays for 2026`);

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
