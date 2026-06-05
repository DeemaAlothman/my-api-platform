import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding clinic roles...');

  // 1. Insert clinic roles
  await prisma.$executeRawUnsafe(`
INSERT INTO users.roles (id, name, "displayNameAr", "displayNameEn", description, "deletedAt", "createdAt", "updatedAt")
VALUES
  ('c1000001-0000-0000-0000-000000000001', 'clinic_reception',           'استقبال العيادة',        'Clinic Reception',           NULL, NULL, NOW(), NOW()),
  ('c1000001-0000-0000-0000-000000000002', 'clinic_prosthetist',         'فني أطراف صناعية',        'Prosthetist',                NULL, NULL, NOW(), NOW()),
  ('c1000001-0000-0000-0000-000000000003', 'clinic_physiotherapist',     'معالج فيزيائي',           'Physiotherapist',            NULL, NULL, NOW(), NOW()),
  ('c1000001-0000-0000-0000-000000000004', 'clinic_committee_head',      'رئيس لجنة التقييم',       'Committee Head',             NULL, NULL, NOW(), NOW()),
  ('c1000001-0000-0000-0000-000000000005', 'clinic_workshop_supervisor', 'مسؤول الورشة',            'Workshop Supervisor',        NULL, NULL, NOW(), NOW()),
  ('c1000001-0000-0000-0000-000000000006', 'clinic_dept_head',           'رئيس قسم سريري',          'Clinical Department Head',   NULL, NULL, NOW(), NOW()),
  ('c1000001-0000-0000-0000-000000000007', 'clinic_supervising_doctor',  'الطبيب المشرف',           'Supervising Doctor',         NULL, NULL, NOW(), NOW()),
  ('c1000001-0000-0000-0000-000000000008', 'clinic_inventory_manager',   'مسؤول مخزون العيادة',     'Clinic Inventory Manager',   NULL, NULL, NOW(), NOW()),
  ('c1000001-0000-0000-0000-000000000009', 'clinic_medical_director',    'المدير الطبي',            'Medical Director',           NULL, NULL, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
  `);

  console.log('Clinic roles inserted.');

  // 2. Assign permissions to roles
  // Permission lookup helper: we'll use the permission name to find its ID

  const rolePermissions: Record<string, string[]> = {
    clinic_reception: [
      'clinic.patients.view',
      'clinic.patients.create',
      'clinic.patients.edit',
      'clinic.patients.view_documents',
      'clinic.patients.upload_documents',
      'clinic.patients.view_consents',
      'clinic.patients.create_consents',
      'clinic.patients.create_notes',
      'clinic.prosthetics.case.create',
      'clinic.physio.case.create',
      'clinic.appointments.view',
      'clinic.appointments.create',
      'clinic.appointments.cancel',
    ],
    clinic_prosthetist: [
      'clinic.patients.view',
      'clinic.patients.create_notes',
      'clinic.prosthetics.case.view',
      'clinic.prosthetics.assessment.create',
      'clinic.prosthetics.committee.opinion',
      'clinic.prosthetics.components.add',
      'clinic.prosthetics.gait.create',
      'clinic.prosthetics.delivery.create',
      'clinic.inventory.view',
      'clinic.inventory.issue',
      'clinic.reports.view_clinical',
      'clinic.appointments.view',
    ],
    clinic_physiotherapist: [
      'clinic.patients.view',
      'clinic.patients.create_notes',
      'clinic.physio.case.view',
      'clinic.physio.case.create',
      'clinic.physio.assessment.create',
      'clinic.physio.sessions.create',
      'clinic.prosthetics.case.view',
      'clinic.prosthetics.assessment.create',
      'clinic.prosthetics.committee.opinion',
      'clinic.prosthetics.gait.create',
      'clinic.reports.view_clinical',
      'clinic.appointments.view',
    ],
    clinic_committee_head: [
      'clinic.patients.view',
      'clinic.patients.create_notes',
      'clinic.prosthetics.case.view',
      'clinic.prosthetics.committee.opinion',
      'clinic.prosthetics.committee.decide',
      'clinic.appointments.view',
      'clinic.reports.view_clinical',
      'clinic.reports.view_donor',
    ],
    clinic_workshop_supervisor: [
      'clinic.patients.view',
      'clinic.patients.create_notes',
      'clinic.prosthetics.case.view',
      'clinic.prosthetics.components.add',
      'clinic.prosthetics.delivery.create',
      'clinic.inventory.view',
      'clinic.inventory.issue',
    ],
    clinic_dept_head: [
      'clinic.patients.view',
      'clinic.patients.create',
      'clinic.patients.edit',
      'clinic.patients.view_documents',
      'clinic.patients.upload_documents',
      'clinic.patients.view_consents',
      'clinic.patients.create_consents',
      'clinic.patients.create_notes',
      'clinic.prosthetics.case.create',
      'clinic.prosthetics.case.view',
      'clinic.prosthetics.assessment.create',
      'clinic.prosthetics.committee.opinion',
      'clinic.prosthetics.committee.decide',
      'clinic.prosthetics.components.add',
      'clinic.prosthetics.gait.create',
      'clinic.prosthetics.delivery.create',
      'clinic.physio.case.create',
      'clinic.physio.case.view',
      'clinic.physio.assessment.create',
      'clinic.physio.supervisor_review',
      'clinic.physio.sessions.create',
      'clinic.appointments.view',
      'clinic.appointments.create',
      'clinic.appointments.cancel',
      'clinic.inventory.view',
      'clinic.inventory.issue',
      'clinic.reports.view_clinical',
      'clinic.reports.view_donor',
    ],
    clinic_supervising_doctor: [
      'clinic.patients.view',
      'clinic.patients.create',
      'clinic.patients.edit',
      'clinic.patients.delete',
      'clinic.patients.view_documents',
      'clinic.patients.upload_documents',
      'clinic.patients.view_consents',
      'clinic.patients.create_consents',
      'clinic.patients.create_notes',
      'clinic.prosthetics.case.create',
      'clinic.prosthetics.case.view',
      'clinic.prosthetics.assessment.create',
      'clinic.prosthetics.committee.opinion',
      'clinic.prosthetics.committee.decide',
      'clinic.prosthetics.committee.sign',
      'clinic.prosthetics.components.add',
      'clinic.prosthetics.gait.create',
      'clinic.prosthetics.delivery.create',
      'clinic.prosthetics.delivery.approve',
      'clinic.physio.case.create',
      'clinic.physio.case.view',
      'clinic.physio.assessment.create',
      'clinic.physio.supervisor_review',
      'clinic.physio.plan.sign',
      'clinic.physio.sessions.create',
      'clinic.appointments.view',
      'clinic.appointments.create',
      'clinic.appointments.cancel',
      'clinic.inventory.view',
      'clinic.inventory.issue',
      'clinic.reports.view_clinical',
      'clinic.reports.view_donor',
    ],
    clinic_inventory_manager: [
      'clinic.inventory.view',
      'clinic.inventory.manage',
      'clinic.inventory.issue',
      'clinic.prosthetics.components.add',
    ],
    clinic_medical_director: [
      'clinic.patients.view',
      'clinic.patients.create',
      'clinic.patients.edit',
      'clinic.patients.delete',
      'clinic.patients.view_documents',
      'clinic.patients.upload_documents',
      'clinic.patients.view_consents',
      'clinic.patients.create_consents',
      'clinic.patients.create_notes',
      'clinic.prosthetics.case.create',
      'clinic.prosthetics.case.view',
      'clinic.prosthetics.assessment.create',
      'clinic.prosthetics.committee.opinion',
      'clinic.prosthetics.committee.decide',
      'clinic.prosthetics.committee.sign',
      'clinic.prosthetics.components.add',
      'clinic.prosthetics.gait.create',
      'clinic.prosthetics.delivery.create',
      'clinic.prosthetics.delivery.approve',
      'clinic.physio.case.create',
      'clinic.physio.case.view',
      'clinic.physio.assessment.create',
      'clinic.physio.supervisor_review',
      'clinic.physio.plan.sign',
      'clinic.physio.sessions.create',
      'clinic.appointments.view',
      'clinic.appointments.create',
      'clinic.appointments.cancel',
      'clinic.inventory.view',
      'clinic.inventory.manage',
      'clinic.inventory.issue',
      'clinic.reports.view_clinical',
      'clinic.reports.view_donor',
    ],
  };

  for (const [roleName, permissions] of Object.entries(rolePermissions)) {
    for (const permName of permissions) {
      await prisma.$executeRawUnsafe(`
INSERT INTO users.role_permissions ("roleId", "permissionId")
SELECT r.id, p.id
FROM users.roles r
CROSS JOIN users.permissions p
WHERE r.name = $1 AND p.name = $2
ON CONFLICT DO NOTHING;
      `, roleName, permName);
    }
    console.log(`  Assigned ${permissions.length} permissions to ${roleName}`);
  }

  console.log('Clinic roles seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
