/**
 * seed-demo.ts — بيانات تجريبية شاملة لـ users service
 * كلمة المرور لجميع المستخدمين التجريبيين: Demo@123456
 *
 * IDs ثابتة لاستخدامها في seeds الخدمات الأخرى:
 *   sarah.hr  → emp: e0000001-0000-0000-0000-000000000000
 *   khalid.it → emp: e0000002-0000-0000-0000-000000000000 (مدير IT)
 *   fatima.dev→ emp: e0000003-0000-0000-0000-000000000000 (تحت khalid)
 *   omar.dev  → emp: e0000004-0000-0000-0000-000000000000 (تحت khalid)
 *   nora.fin  → emp: e0000005-0000-0000-0000-000000000000
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const D = {
  dept:  { hr: 'a0000001-0000-0000-0000-000000000000', fin: 'a0000002-0000-0000-0000-000000000000', sales: 'a0000003-0000-0000-0000-000000000000' },
  grade: { g1: 'b0000001-0000-0000-0000-000000000000', g2: 'b0000002-0000-0000-0000-000000000000', g3: 'b0000003-0000-0000-0000-000000000000', g4: 'b0000004-0000-0000-0000-000000000000' },
  title: { hr_mgr: 'c0000001-0000-0000-0000-000000000000', it_mgr: 'c0000002-0000-0000-0000-000000000000', acc: 'c0000003-0000-0000-0000-000000000000', sales: 'c0000004-0000-0000-0000-000000000000' },
  user:  { sarah: 'd0000001-0000-0000-0000-000000000000', khalid: 'd0000002-0000-0000-0000-000000000000', fatima: 'd0000003-0000-0000-0000-000000000000', omar: 'd0000004-0000-0000-0000-000000000000', nora: 'd0000005-0000-0000-0000-000000000000' },
  emp:   { sarah: 'e0000001-0000-0000-0000-000000000000', khalid: 'e0000002-0000-0000-0000-000000000000', fatima: 'e0000003-0000-0000-0000-000000000000', omar: 'e0000004-0000-0000-0000-000000000000', nora: 'e0000005-0000-0000-0000-000000000000' },
};

async function main() {
  console.log('🌱 Seeding demo data for users service...');
  const password = await bcrypt.hash('Demo@123456', 10);

  // ===== 1. Departments =====
  await prisma.department.upsert({ where: { code: 'HR' },    update: {}, create: { id: D.dept.hr,    code: 'HR',    nameAr: 'الموارد البشرية',        nameEn: 'Human Resources' } });
  await prisma.department.upsert({ where: { code: 'FIN' },   update: {}, create: { id: D.dept.fin,   code: 'FIN',   nameAr: 'المالية والمحاسبة',      nameEn: 'Finance & Accounting' } });
  await prisma.department.upsert({ where: { code: 'SALES' }, update: {}, create: { id: D.dept.sales, code: 'SALES', nameAr: 'المبيعات والتسويق',     nameEn: 'Sales & Marketing' } });
  console.log('✅ Departments (HR, FIN, SALES)');

  // ===== 2. Job Grades =====
  await prisma.jobGrade.upsert({ where: { code: 'G1' }, update: {}, create: { id: D.grade.g1, code: 'G1', nameAr: 'الدرجة الأولى',  nameEn: 'Grade 1', order: 1, minSalary: 3000, maxSalary: 5000 } });
  await prisma.jobGrade.upsert({ where: { code: 'G2' }, update: {}, create: { id: D.grade.g2, code: 'G2', nameAr: 'الدرجة الثانية', nameEn: 'Grade 2', order: 2, minSalary: 5000, maxSalary: 8000 } });
  await prisma.jobGrade.upsert({ where: { code: 'G3' }, update: {}, create: { id: D.grade.g3, code: 'G3', nameAr: 'الدرجة الثالثة', nameEn: 'Grade 3', order: 3, minSalary: 8000, maxSalary: 12000 } });
  await prisma.jobGrade.upsert({ where: { code: 'G4' }, update: {}, create: { id: D.grade.g4, code: 'G4', nameAr: 'الدرجة الرابعة', nameEn: 'Grade 4', order: 4, minSalary: 12000, maxSalary: 20000 } });
  console.log('✅ Job Grades (G1-G4)');

  // ===== 3. Job Titles =====
  await prisma.jobTitle.upsert({ where: { code: 'HR_MGR'    }, update: {}, create: { id: D.title.hr_mgr, code: 'HR_MGR',    nameAr: 'مدير الموارد البشرية',    nameEn: 'HR Manager' } });
  await prisma.jobTitle.upsert({ where: { code: 'IT_MGR'    }, update: {}, create: { id: D.title.it_mgr, code: 'IT_MGR',    nameAr: 'مدير تقنية المعلومات',   nameEn: 'IT Manager' } });
  await prisma.jobTitle.upsert({ where: { code: 'ACCOUNTANT'}, update: {}, create: { id: D.title.acc,    code: 'ACCOUNTANT', nameAr: 'محاسب',                  nameEn: 'Accountant' } });
  await prisma.jobTitle.upsert({ where: { code: 'SALES_REP' }, update: {}, create: { id: D.title.sales,  code: 'SALES_REP',  nameAr: 'مندوب مبيعات',           nameEn: 'Sales Representative' } });
  console.log('✅ Job Titles');

  // IT dept & DEV title (created in base seed)
  const itDept   = await prisma.department.findUnique({ where: { code: 'IT'  } });
  const devTitle = await prisma.jobTitle.findUnique({   where: { code: 'DEV' } });

  // ===== 4. Users =====
  await prisma.user.upsert({ where: { username: 'sarah.hr'   }, update: { password }, create: { id: D.user.sarah,  username: 'sarah.hr',   email: 'sarah.hr@wso.org',   fullName: 'سارة أحمد',  password, status: 'ACTIVE' } });
  await prisma.user.upsert({ where: { username: 'khalid.it'  }, update: { password }, create: { id: D.user.khalid, username: 'khalid.it',  email: 'khalid.it@wso.org',  fullName: 'خالد محمد',  password, status: 'ACTIVE' } });
  await prisma.user.upsert({ where: { username: 'fatima.dev' }, update: { password }, create: { id: D.user.fatima, username: 'fatima.dev', email: 'fatima.dev@wso.org', fullName: 'فاطمة علي',  password, status: 'ACTIVE' } });
  await prisma.user.upsert({ where: { username: 'omar.dev'   }, update: { password }, create: { id: D.user.omar,   username: 'omar.dev',   email: 'omar.dev@wso.org',   fullName: 'عمر خالد',   password, status: 'ACTIVE' } });
  await prisma.user.upsert({ where: { username: 'nora.fin'   }, update: { password }, create: { id: D.user.nora,   username: 'nora.fin',   email: 'nora.fin@wso.org',   fullName: 'نورة سالم',  password, status: 'ACTIVE' } });
  console.log('✅ Users (5 demo users, password: Demo@123456)');

  // ===== 5. Employees =====
  // Sarah — مديرة الموارد البشرية
  await prisma.employee.upsert({
    where: { userId: D.user.sarah },
    update: {},
    create: {
      id: D.emp.sarah, userId: D.user.sarah,
      employeeNumber: 'EMP002',
      firstNameAr: 'سارة', lastNameAr: 'أحمد', firstNameEn: 'Sarah', lastNameEn: 'Ahmed',
      email: 'sarah.hr@wso.org', phone: '+966500000002', nationalId: '1000000002',
      gender: 'FEMALE', maritalStatus: 'MARRIED',
      hireDate: new Date('2023-01-15'), contractType: 'INDEFINITE',
      departmentId: D.dept.hr, jobTitleId: D.title.hr_mgr, jobGradeId: D.grade.g3,
      basicSalary: 10000, employmentStatus: 'ACTIVE',
    },
  });

  // Khalid — مدير IT
  await prisma.employee.upsert({
    where: { userId: D.user.khalid },
    update: {},
    create: {
      id: D.emp.khalid, userId: D.user.khalid,
      employeeNumber: 'EMP003',
      firstNameAr: 'خالد', lastNameAr: 'محمد', firstNameEn: 'Khalid', lastNameEn: 'Mohammed',
      email: 'khalid.it@wso.org', phone: '+966500000003', nationalId: '1000000003',
      gender: 'MALE', maritalStatus: 'MARRIED',
      hireDate: new Date('2022-06-01'), contractType: 'INDEFINITE',
      departmentId: itDept?.id ?? D.dept.hr, jobTitleId: D.title.it_mgr, jobGradeId: D.grade.g4,
      basicSalary: 15000, employmentStatus: 'ACTIVE',
    },
  });

  // Fatima — مطورة تحت إشراف خالد
  await prisma.employee.upsert({
    where: { userId: D.user.fatima },
    update: {},
    create: {
      id: D.emp.fatima, userId: D.user.fatima,
      employeeNumber: 'EMP004',
      firstNameAr: 'فاطمة', lastNameAr: 'علي', firstNameEn: 'Fatima', lastNameEn: 'Ali',
      email: 'fatima.dev@wso.org', phone: '+966500000004', nationalId: '1000000004',
      gender: 'FEMALE', maritalStatus: 'SINGLE', hasDrivingLicense: true,
      hireDate: new Date('2024-03-01'), contractType: 'INDEFINITE',
      departmentId: itDept?.id ?? D.dept.hr,
      jobTitleId: devTitle?.id ?? D.title.it_mgr,
      jobGradeId: D.grade.g1,
      basicSalary: 6000, managerId: D.emp.khalid, employmentStatus: 'ACTIVE',
      allowances: { create: [{ type: 'FOOD', amount: 300 }] },
    },
  });

  // Omar — مطور تحت إشراف خالد
  await prisma.employee.upsert({
    where: { userId: D.user.omar },
    update: {},
    create: {
      id: D.emp.omar, userId: D.user.omar,
      employeeNumber: 'EMP005',
      firstNameAr: 'عمر', lastNameAr: 'خالد', firstNameEn: 'Omar', lastNameEn: 'Khalid',
      email: 'omar.dev@wso.org', phone: '+966500000005', nationalId: '1000000005',
      gender: 'MALE', maritalStatus: 'SINGLE',
      hireDate: new Date('2024-06-01'), contractType: 'INDEFINITE',
      departmentId: itDept?.id ?? D.dept.hr,
      jobTitleId: devTitle?.id ?? D.title.it_mgr,
      jobGradeId: D.grade.g2,
      basicSalary: 7500, managerId: D.emp.khalid, employmentStatus: 'ACTIVE',
    },
  });

  // Nora — محاسبة
  await prisma.employee.upsert({
    where: { userId: D.user.nora },
    update: {},
    create: {
      id: D.emp.nora, userId: D.user.nora,
      employeeNumber: 'EMP006',
      firstNameAr: 'نورة', lastNameAr: 'سالم', firstNameEn: 'Nora', lastNameEn: 'Salem',
      email: 'nora.fin@wso.org', phone: '+966500000006', nationalId: '1000000006',
      gender: 'FEMALE', maritalStatus: 'MARRIED',
      hireDate: new Date('2023-09-01'), contractType: 'INDEFINITE',
      departmentId: D.dept.fin, jobTitleId: D.title.acc, jobGradeId: D.grade.g2,
      basicSalary: 8000, employmentStatus: 'ACTIVE',
      allowances: { create: [{ type: 'FOOD', amount: 400 }, { type: 'RESIDENCE', amount: 1000 }] },
    },
  });

  console.log('✅ Employees (5 demo employees with hierarchy)');
  console.log('');
  console.log('📋 Demo Users Summary:');
  console.log('   sarah.hr   / Demo@123456 → مديرة الموارد البشرية');
  console.log('   khalid.it  / Demo@123456 → مدير IT (مسؤول عن فاطمة وعمر)');
  console.log('   fatima.dev / Demo@123456 → مطورة (تحت خالد)');
  console.log('   omar.dev   / Demo@123456 → مطور (تحت خالد)');
  console.log('   nora.fin   / Demo@123456 → محاسبة');
  console.log('🎉 Demo seed completed!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
