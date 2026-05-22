import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SYSTEM_USER = '00000000-0000-0000-0000-000000000001';

// Stable UUIDs for demo patients
const PATIENT_IDS = [
  'a0000001-0000-0000-0000-000000000001',
  'a0000001-0000-0000-0000-000000000002',
  'a0000001-0000-0000-0000-000000000003',
  'a0000001-0000-0000-0000-000000000004',
  'a0000001-0000-0000-0000-000000000005',
  'a0000001-0000-0000-0000-000000000006',
  'a0000001-0000-0000-0000-000000000007',
  'a0000001-0000-0000-0000-000000000008',
  'a0000001-0000-0000-0000-000000000009',
  'a0000001-0000-0000-0000-000000000010',
  'a0000001-0000-0000-0000-000000000011',
  'a0000001-0000-0000-0000-000000000012',
  'a0000001-0000-0000-0000-000000000013',
  'a0000001-0000-0000-0000-000000000014',
  'a0000001-0000-0000-0000-000000000015',
  'a0000001-0000-0000-0000-000000000016',
  'a0000001-0000-0000-0000-000000000017',
  'a0000001-0000-0000-0000-000000000018',
  'a0000001-0000-0000-0000-000000000019',
  'a0000001-0000-0000-0000-000000000020',
];

// Stable UUIDs for demo prosthetics cases
const PROS_CASE_IDS = Array.from({ length: 10 }, (_, i) =>
  `b0000001-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
);

// Stable UUIDs for demo physio cases
const PHYSIO_CASE_IDS = Array.from({ length: 8 }, (_, i) =>
  `c0000001-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
);

// Stable UUIDs for demo appointments
const APPT_IDS = Array.from({ length: 50 }, (_, i) =>
  `d0000001-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
);

// Stable UUIDs for demo inventory items
const ITEM_IDS = Array.from({ length: 30 }, (_, i) =>
  `e0000001-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
);

const SUPPLIER_IDS = {
  ottobock: 'f0000001-0000-0000-0000-000000000001',
  ossur:    'f0000001-0000-0000-0000-000000000002',
  local:    'f0000001-0000-0000-0000-000000000003',
};

// Demo practitioner IDs (clinic staff — these reference users who should exist)
const PRACTITIONER_IDS = {
  prosthetist1:  'c1000002-0000-0000-0000-000000000001',
  prosthetist2:  'c1000002-0000-0000-0000-000000000002',
  physio1:       'c1000002-0000-0000-0000-000000000003',
  physio2:       'c1000002-0000-0000-0000-000000000004',
  doctor:        'c1000002-0000-0000-0000-000000000005',
};

async function main() {
  console.log('🌱 Starting clinic demo seed...');

  // ── 1. Cities ────────────────────────────────────────────────────────────────
  console.log('  Inserting cities...');
  await prisma.$executeRawUnsafe(`
    INSERT INTO clinic_patients.cities ("nameAr", "nameEn", "governorate")
    VALUES
      ('دمشق',        'Damascus',  'دمشق'),
      ('حلب',         'Aleppo',    'حلب'),
      ('حمص',         'Homs',      'حمص'),
      ('حماة',        'Hama',      'حماة'),
      ('اللاذقية',   'Latakia',   'اللاذقية'),
      ('درعا',        'Daraa',     'درعا'),
      ('دير الزور',  'Deir ez-Zor','دير الزور'),
      ('الحسكة',     'Al-Hasakah','الحسكة')
    ON CONFLICT ("nameAr", "governorate") DO NOTHING
  `);

  const cities = await prisma.$queryRawUnsafe<Array<{ id: number; nameAr: string }>>(
    `SELECT id, "nameAr" FROM clinic_patients.cities ORDER BY id LIMIT 8`,
  );
  const cityIds = cities.map((c) => c.id);
  if (cityIds.length === 0) throw new Error('No cities found after insert');

  // ── 2. Patients ───────────────────────────────────────────────────────────────
  console.log('  Inserting patients...');
  const patientData = [
    { first: 'أحمد',    last: 'المحمد',  idNum: 'SY20010001', gender: 'MALE',   dob: '1985-03-15', phone: '0912345001' },
    { first: 'خالد',    last: 'الحسين',  idNum: 'SY20010002', gender: 'MALE',   dob: '1990-07-22', phone: '0912345002' },
    { first: 'محمد',    last: 'السالم',  idNum: 'SY20010003', gender: 'MALE',   dob: '1978-11-08', phone: '0912345003' },
    { first: 'سامر',    last: 'العلي',   idNum: 'SY20010004', gender: 'MALE',   dob: '1992-05-30', phone: '0912345004' },
    { first: 'عمر',     last: 'الزيد',   idNum: 'SY20010005', gender: 'MALE',   dob: '1988-09-14', phone: '0912345005' },
    { first: 'يوسف',    last: 'الأحمد',  idNum: 'SY20010006', gender: 'MALE',   dob: '1995-01-20', phone: '0912345006' },
    { first: 'فاطمة',   last: 'الخليل',  idNum: 'SY20010007', gender: 'FEMALE', dob: '1987-06-18', phone: '0912345007' },
    { first: 'مريم',    last: 'الحمد',   idNum: 'SY20010008', gender: 'FEMALE', dob: '1993-02-25', phone: '0912345008' },
    { first: 'نور',     last: 'السعيد',  idNum: 'SY20010009', gender: 'FEMALE', dob: '1980-08-12', phone: '0912345009' },
    { first: 'ليلى',    last: 'المصطفى', idNum: 'SY20010010', gender: 'FEMALE', dob: '1996-04-03', phone: '0912345010' },
    { first: 'بلال',    last: 'الشيخ',   idNum: 'SY20010011', gender: 'MALE',   dob: '1983-12-07', phone: '0912345011' },
    { first: 'حسن',     last: 'المالك',  idNum: 'SY20010012', gender: 'MALE',   dob: '1975-10-19', phone: '0912345012' },
    { first: 'علي',     last: 'الراشد',  idNum: 'SY20010013', gender: 'MALE',   dob: '1999-03-28', phone: '0912345013' },
    { first: 'وليد',    last: 'الجابر',  idNum: 'SY20010014', gender: 'MALE',   dob: '1986-07-05', phone: '0912345014' },
    { first: 'طارق',    last: 'القاسم',  idNum: 'SY20010015', gender: 'MALE',   dob: '1991-09-23', phone: '0912345015' },
    { first: 'رنا',     last: 'الحسن',   idNum: 'SY20010016', gender: 'FEMALE', dob: '1994-11-16', phone: '0912345016' },
    { first: 'سارة',    last: 'المنصور', idNum: 'SY20010017', gender: 'FEMALE', dob: '1982-05-09', phone: '0912345017' },
    { first: 'دانا',    last: 'الكريم',  idNum: 'SY20010018', gender: 'FEMALE', dob: '1997-01-31', phone: '0912345018' },
    { first: 'أنس',     last: 'الطيب',   idNum: 'SY20010019', gender: 'MALE',   dob: '1977-08-27', phone: '0912345019' },
    { first: 'زياد',    last: 'الدباغ',  idNum: 'SY20010020', gender: 'MALE',   dob: '2000-06-14', phone: '0912345020' },
  ];

  for (let i = 0; i < patientData.length; i++) {
    const p = patientData[i];
    const cityId = cityIds[i % cityIds.length];
    await prisma.$executeRawUnsafe(`
      INSERT INTO clinic_patients.patients
        (id, "patientNumber", "firstName", "lastName", "idType", "idNumber",
         "dateOfBirth", gender, "cityId", phone, "createdAt", "updatedAt", "createdBy")
      VALUES
        ($1, $2, $3, $4, 'NATIONAL_ID'::clinic_patients."IdType", $5, $6::date, $7::clinic_patients."Gender", $8, $9, NOW(), NOW(), $10)
      ON CONFLICT DO NOTHING
    `,
      PATIENT_IDS[i], `P-2026-${String(i + 1).padStart(4, '0')}`,
      p.first, p.last, p.idNum, p.dob, p.gender, cityId, p.phone, SYSTEM_USER,
    );
  }

  // ── 3. Inventory Suppliers ────────────────────────────────────────────────────
  console.log('  Inserting inventory suppliers...');
  await prisma.$executeRawUnsafe(`
    INSERT INTO clinic_inventory.suppliers (id, name, "contactInfo")
    VALUES
      ($1, 'Ottobock', '{"email":"info@ottobock.com","phone":"+49123456789"}'),
      ($2, 'Össur',    '{"email":"info@ossur.com","phone":"+35412345678"}'),
      ($3, 'محلي',     '{"phone":"0911234567"}')
    ON CONFLICT (id) DO NOTHING
  `, SUPPLIER_IDS.ottobock, SUPPLIER_IDS.ossur, SUPPLIER_IDS.local);

  // ── 4. Inventory Categories ────────────────────────────────────────────────────
  console.log('  Inserting inventory categories...');
  for (const cat of [
    { name: 'Lower Limb Components', nameAr: 'مكونات الطرف السفلي', type: 'COMPONENT' },
    { name: 'Upper Limb Components', nameAr: 'مكونات الطرف العلوي', type: 'COMPONENT' },
    { name: 'Consumables',           nameAr: 'المواد الاستهلاكية',  type: 'CONSUMABLE' },
  ]) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO clinic_inventory.inventory_categories ("name", "nameAr", "parentId", type)
      SELECT $1, $2, NULL, $3::"clinic_inventory"."InventoryType"
      WHERE NOT EXISTS (SELECT 1 FROM clinic_inventory.inventory_categories WHERE name = $1)
    `, cat.name, cat.nameAr, cat.type);
  }

  const cats = await prisma.$queryRawUnsafe<Array<{ id: number; name: string }>>(
    `SELECT id, name FROM clinic_inventory.inventory_categories WHERE "parentId" IS NULL ORDER BY id LIMIT 3`,
  );
  const lowerCatId = cats.find((c) => c.name === 'Lower Limb Components')?.id ?? 1;
  const upperCatId = cats.find((c) => c.name === 'Upper Limb Components')?.id ?? 2;
  const consumCatId = cats.find((c) => c.name === 'Consumables')?.id ?? 3;

  // ── 5. Inventory Items ─────────────────────────────────────────────────────────
  console.log('  Inserting inventory items...');
  const items = [
    // Lower limb components (20 items)
    { id: ITEM_IDS[0],  partCode: 'OTT-3R55',    name: 'Polycentric Knee',           nameAr: 'ركبة متعدد المحاور',           cat: lowerCatId, unit: 'pcs', stock: 5,  cost: 1200, type: 'COMPONENT',   sup: SUPPLIER_IDS.ottobock },
    { id: ITEM_IDS[1],  partCode: 'OTT-1C40',    name: 'Carbon Dynamic Foot',        nameAr: 'قدم كربون ديناميكي',            cat: lowerCatId, unit: 'pcs', stock: 8,  cost: 450,  type: 'COMPONENT',   sup: SUPPLIER_IDS.ottobock },
    { id: ITEM_IDS[2],  partCode: 'OTT-3S80',    name: 'Tibial Tube Clamp',          nameAr: 'مشبك أنبوب الساق',              cat: lowerCatId, unit: 'pcs', stock: 15, cost: 80,   type: 'COMPONENT',   sup: SUPPLIER_IDS.ottobock },
    { id: ITEM_IDS[3],  partCode: 'OSS-LPB300',  name: 'Locking Liner TF 300mm',     nameAr: 'بطانة قفل فخذ 300 مم',          cat: lowerCatId, unit: 'pcs', stock: 10, cost: 320,  type: 'COMPONENT',   sup: SUPPLIER_IDS.ossur },
    { id: ITEM_IDS[4],  partCode: 'OSS-LPB250',  name: 'Locking Liner TT 250mm',     nameAr: 'بطانة قفل ساق 250 مم',          cat: lowerCatId, unit: 'pcs', stock: 12, cost: 280,  type: 'COMPONENT',   sup: SUPPLIER_IDS.ossur },
    { id: ITEM_IDS[5],  partCode: 'OTT-3S90',    name: 'Foot Adapter Rotator',       nameAr: 'محوّل قدم دوّار',               cat: lowerCatId, unit: 'pcs', stock: 6,  cost: 150,  type: 'COMPONENT',   sup: SUPPLIER_IDS.ottobock },
    { id: ITEM_IDS[6],  partCode: 'OTT-1A30',    name: 'SACH Foot Size 25',          nameAr: 'قدم SACH مقاس 25',              cat: lowerCatId, unit: 'pcs', stock: 20, cost: 60,   type: 'COMPONENT',   sup: SUPPLIER_IDS.ottobock },
    { id: ITEM_IDS[7],  partCode: 'OTT-1A31',    name: 'SACH Foot Size 27',          nameAr: 'قدم SACH مقاس 27',              cat: lowerCatId, unit: 'pcs', stock: 18, cost: 65,   type: 'COMPONENT',   sup: SUPPLIER_IDS.ottobock },
    { id: ITEM_IDS[8],  partCode: 'OTT-4R56',    name: 'Hydraulic Knee C-Leg',       nameAr: 'ركبة هيدروليكية C-Leg',         cat: lowerCatId, unit: 'pcs', stock: 2,  cost: 8500, type: 'COMPONENT',   sup: SUPPLIER_IDS.ottobock },
    { id: ITEM_IDS[9],  partCode: 'OSS-PYR-TF',  name: 'Pyramid Adapter TF',         nameAr: 'محوّل هرمي فخذ',                cat: lowerCatId, unit: 'pcs', stock: 9,  cost: 120,  type: 'COMPONENT',   sup: SUPPLIER_IDS.ossur },
    { id: ITEM_IDS[10], partCode: 'OTT-TT-SOCK1','name': 'TT Prosthetic Sock Ply 1', nameAr: 'جورب طرف ساق طبقة 1',          cat: lowerCatId, unit: 'pcs', stock: 50, cost: 15,   type: 'COMPONENT',   sup: SUPPLIER_IDS.ottobock },
    { id: ITEM_IDS[11], partCode: 'OTT-TT-SOCK3','name': 'TT Prosthetic Sock Ply 3', nameAr: 'جورب طرف ساق طبقة 3',          cat: lowerCatId, unit: 'pcs', stock: 40, cost: 18,   type: 'COMPONENT',   sup: SUPPLIER_IDS.ottobock },
    // Upper limb components (8 items)
    { id: ITEM_IDS[12], partCode: 'OTT-8E75',    name: 'Voluntary Opening Hook',     nameAr: 'خطاف فتح إرادي',               cat: upperCatId, unit: 'pcs', stock: 7,  cost: 380,  type: 'COMPONENT',   sup: SUPPLIER_IDS.ottobock },
    { id: ITEM_IDS[13], partCode: 'OTT-8E40',    name: 'Myoelectric Hand Size M',    nameAr: 'يد عضلية كهربائية M',          cat: upperCatId, unit: 'pcs', stock: 3,  cost: 4200, type: 'COMPONENT',   sup: SUPPLIER_IDS.ottobock },
    { id: ITEM_IDS[14], partCode: 'OTT-8E41',    name: 'Myoelectric Hand Size L',    nameAr: 'يد عضلية كهربائية L',          cat: upperCatId, unit: 'pcs', stock: 2,  cost: 4200, type: 'COMPONENT',   sup: SUPPLIER_IDS.ottobock },
    { id: ITEM_IDS[15], partCode: 'OTT-8X35',    name: 'Elbow Unit Body Powered',    nameAr: 'وحدة كوع بقوة الجسم',          cat: upperCatId, unit: 'pcs', stock: 4,  cost: 1100, type: 'COMPONENT',   sup: SUPPLIER_IDS.ottobock },
    { id: ITEM_IDS[16], partCode: 'OSS-UL-SOCK', name: 'Upper Limb Suspension Sock', nameAr: 'جورب تثبيت طرف علوي',          cat: upperCatId, unit: 'pcs', stock: 25, cost: 22,   type: 'COMPONENT',   sup: SUPPLIER_IDS.ossur },
    { id: ITEM_IDS[17], partCode: 'OTT-8X22',    name: 'Wrist Rotation Unit',        nameAr: 'وحدة تدوير رسغ',               cat: upperCatId, unit: 'pcs', stock: 6,  cost: 280,  type: 'COMPONENT',   sup: SUPPLIER_IDS.ottobock },
    { id: ITEM_IDS[18], partCode: 'OTT-8X14',    name: 'Shoulder Unit',              nameAr: 'وحدة كتف',                     cat: upperCatId, unit: 'pcs', stock: 3,  cost: 650,  type: 'COMPONENT',   sup: SUPPLIER_IDS.ottobock },
    { id: ITEM_IDS[19], partCode: 'OSS-MYOLIN',  name: 'Myoelectric Liner',          nameAr: 'بطانة عضلية كهربائية',         cat: upperCatId, unit: 'pcs', stock: 8,  cost: 390,  type: 'COMPONENT',   sup: SUPPLIER_IDS.ossur },
    // Consumables (10 items)
    { id: ITEM_IDS[20], partCode: 'CON-RESIN-1L','name': 'Lamination Resin 1L',      nameAr: 'راتنج تصفيح 1 لتر',            cat: consumCatId, unit: 'bottle', stock: 30, cost: 25,  type: 'CONSUMABLE', sup: SUPPLIER_IDS.local },
    { id: ITEM_IDS[21], partCode: 'CON-SOCK-PLY','name': 'Prosthetic Interface Sock',nameAr: 'جورب واجهة اصطناعي',           cat: consumCatId, unit: 'pcs',    stock: 60, cost: 8,   type: 'CONSUMABLE', sup: SUPPLIER_IDS.local },
    { id: ITEM_IDS[22], partCode: 'CON-CARBON-F','name': 'Carbon Fiber Fabric Roll',  nameAr: 'لفة قماش كربون',               cat: consumCatId, unit: 'roll',   stock: 15, cost: 85,  type: 'CONSUMABLE', sup: SUPPLIER_IDS.local },
    { id: ITEM_IDS[23], partCode: 'CON-WRAP-4IN','name': 'Compression Wrap 4"',       nameAr: 'ضمادة ضاغطة 4 بوصة',          cat: consumCatId, unit: 'pcs',    stock: 80, cost: 4,   type: 'CONSUMABLE', sup: SUPPLIER_IDS.local },
    { id: ITEM_IDS[24], partCode: 'CON-GLOVES',  'name': 'Latex Gloves Box',          nameAr: 'علبة قفازات مطاط',             cat: consumCatId, unit: 'box',    stock: 25, cost: 6,   type: 'CONSUMABLE', sup: SUPPLIER_IDS.local },
    { id: ITEM_IDS[25], partCode: 'CON-ALGNT',   'name': 'Alignment Block Set',       nameAr: 'مجموعة بلوك المحاذاة',        cat: consumCatId, unit: 'set',    stock: 10, cost: 35,  type: 'CONSUMABLE', sup: SUPPLIER_IDS.local },
    { id: ITEM_IDS[26], partCode: 'CON-PLAST',   'name': 'Thermoplastic Sheet 3mm',   nameAr: 'لوح ثرموبلاستيك 3 مم',        cat: consumCatId, unit: 'sheet',  stock: 20, cost: 18,  type: 'CONSUMABLE', sup: SUPPLIER_IDS.local },
    { id: ITEM_IDS[27], partCode: 'CON-FOAM',    'name': 'Interface Foam Padding',    nameAr: 'حشوة إسفنج واجهة',            cat: consumCatId, unit: 'roll',   stock: 12, cost: 22,  type: 'CONSUMABLE', sup: SUPPLIER_IDS.local },
    { id: ITEM_IDS[28], partCode: 'CON-STRP',    'name': 'Suspension Strap Velcro',   nameAr: 'حزام تثبيت فيلكرو',           cat: consumCatId, unit: 'pcs',    stock: 35, cost: 7,   type: 'CONSUMABLE', sup: SUPPLIER_IDS.local },
    { id: ITEM_IDS[29], partCode: 'CON-CAST',    'name': 'Plaster of Paris Roll',     nameAr: 'لفة جبس',                     cat: consumCatId, unit: 'roll',   stock: 40, cost: 3,   type: 'CONSUMABLE', sup: SUPPLIER_IDS.local },
  ];

  for (const item of items) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO clinic_inventory.inventory_items
        (id, "partCode", name, "nameAr", "categoryId", "supplierId", unit, "currentStock", "unitCostUsd", type, "isActive", "createdAt", "updatedAt")
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::"clinic_inventory"."InventoryType", true, NOW(), NOW())
      ON CONFLICT DO NOTHING
    `, item.id, item.partCode, item.name, item.nameAr, item.cat, item.sup, item.unit,
       item.stock, item.cost, item.type);
  }

  // ── 6. Prosthetics Cases (10 cases at different stages) ──────────────────────
  console.log('  Inserting prosthetics cases...');
  const prostheticsCases = [
    { id: PROS_CASE_IDS[0], num: 'PR-2026-0001', pid: PATIENT_IDS[0],  status: 'INTAKE',          type: 'LOWER', side: 'RIGHT', level: 'TT', cause: 'حادث سير',       prosType: null },
    { id: PROS_CASE_IDS[1], num: 'PR-2026-0002', pid: PATIENT_IDS[1],  status: 'ASSESSMENT',      type: 'LOWER', side: 'LEFT',  level: 'TF', cause: 'حادث عمل',       prosType: null },
    { id: PROS_CASE_IDS[2], num: 'PR-2026-0003', pid: PATIENT_IDS[2],  status: 'COMMITTEE_REVIEW',type: 'LOWER', side: 'RIGHT', level: 'KD', cause: 'إصابة حربية',    prosType: null },
    { id: PROS_CASE_IDS[3], num: 'PR-2026-0004', pid: PATIENT_IDS[3],  status: 'APPROVED',        type: 'UPPER', side: 'LEFT',  level: 'TH', cause: 'إصابة حربية',    prosType: 'MYOBOCK' },
    { id: PROS_CASE_IDS[4], num: 'PR-2026-0005', pid: PATIENT_IDS[4],  status: 'FITTING',         type: 'LOWER', side: 'RIGHT', level: 'TT', cause: 'مرض السكري',     prosType: 'MECHANIC' },
    { id: PROS_CASE_IDS[5], num: 'PR-2026-0006', pid: PATIENT_IDS[5],  status: 'SOCKET_TRIAL',    type: 'LOWER', side: 'RIGHT', level: 'TF', cause: 'حادث سير',       prosType: 'MECHANIC' },
    { id: PROS_CASE_IDS[6], num: 'PR-2026-0007', pid: PATIENT_IDS[6],  status: 'GAIT_TRAINING',   type: 'LOWER', side: 'LEFT',  level: 'TT', cause: 'إصابة حربية',    prosType: 'MECHANIC' },
    { id: PROS_CASE_IDS[7], num: 'PR-2026-0008', pid: PATIENT_IDS[7],  status: 'FINAL_REVIEW',    type: 'LOWER', side: 'RIGHT', level: 'TF', cause: 'حادث سير',       prosType: 'MECHANIC' },
    { id: PROS_CASE_IDS[8], num: 'PR-2026-0009', pid: PATIENT_IDS[8],  status: 'DELIVERED',       type: 'LOWER', side: 'RIGHT', level: 'TT', cause: 'مرض السكري',     prosType: 'MECHANIC' },
    { id: PROS_CASE_IDS[9], num: 'PR-2026-0010', pid: PATIENT_IDS[9],  status: 'FOLLOW_UP',       type: 'LOWER', side: 'BILATERAL', level: 'TT', cause: 'إصابة حربية', prosType: 'MECHANIC' },
  ];

  for (const c of prostheticsCases) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO clinic_prosthetics.prosthetics_cases
        (id, "caseNumber", "patientId", "amputationDate", "amputationCause", "amputationCount",
         "amputationType", "amputationSide", "amputationLevel", status,
         "hasPreviousProsthesis", "hasRevisionSurgery", "hasPhysicalTherapy", "hasChronicDiseases",
         "prosthetistId", "prosthesisType",
         "createdAt", "updatedAt", "createdBy")
      VALUES
        ($1, $2, $3, '2025-01-15'::date, $4, 1,
         $5::"clinic_prosthetics"."AmputationType", $6::"clinic_prosthetics"."AmputationSide",
         $7::"clinic_prosthetics"."AmputationLevel", $8::"clinic_prosthetics"."CaseStatus",
         false, false, false, false,
         $9, $10::"clinic_prosthetics"."ProsthesisType",
         NOW(), NOW(), $11)
      ON CONFLICT DO NOTHING
    `, c.id, c.num, c.pid, c.cause, c.type, c.side, c.level, c.status,
       PRACTITIONER_IDS.prosthetist1, c.prosType, SYSTEM_USER);
  }

  // ── 7. Physio Cases (8 cases) ─────────────────────────────────────────────────
  console.log('  Inserting physio cases...');
  const physioCases = [
    { id: PHYSIO_CASE_IDS[0], num: 'PT-2026-0001', pid: PATIENT_IDS[10], status: 'INTAKE',            complaint: 'ألم في الظهر السفلي', symptoms: 'ألم مزمن في المنطقة القطنية' },
    { id: PHYSIO_CASE_IDS[1], num: 'PT-2026-0002', pid: PATIENT_IDS[11], status: 'ASSESSMENT',        complaint: 'صعوبة في الحركة',     symptoms: 'تيبس مفاصل الركبة بعد الجلوس' },
    { id: PHYSIO_CASE_IDS[2], num: 'PT-2026-0003', pid: PATIENT_IDS[12], status: 'PLAN_REVIEW',       complaint: 'ألم في الكتف',        symptoms: 'ألم حاد عند الرفع وتدوير الذراع' },
    { id: PHYSIO_CASE_IDS[3], num: 'PT-2026-0004', pid: PATIENT_IDS[13], status: 'ACTIVE_TREATMENT',  complaint: 'إعادة تأهيل بعد الطرف', symptoms: 'تدريب على الطرف الاصطناعي الجديد' },
    { id: PHYSIO_CASE_IDS[4], num: 'PT-2026-0005', pid: PATIENT_IDS[14], status: 'ACTIVE_TREATMENT',  complaint: 'ألم عنق وكتف',        symptoms: 'ألم ينتشر من العنق للذراع' },
    { id: PHYSIO_CASE_IDS[5], num: 'PT-2026-0006', pid: PATIENT_IDS[15], status: 'ACTIVE_TREATMENT',  complaint: 'ضعف عضلي في الساقين', symptoms: 'صعوبة في الوقوف لفترة طويلة' },
    { id: PHYSIO_CASE_IDS[6], num: 'PT-2026-0007', pid: PATIENT_IDS[16], status: 'COMPLETED',         complaint: 'ألم في الركبة',        symptoms: 'التهاب مفصل الركبة بعد إصابة رياضية' },
    { id: PHYSIO_CASE_IDS[7], num: 'PT-2026-0008', pid: PATIENT_IDS[17], status: 'DISCHARGED',        complaint: 'ألم مزمن في الوركين', symptoms: 'تضييق الفجوة المفصلية وألم عند المشي' },
  ];

  for (const c of physioCases) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO clinic_physio.physio_cases
        (id, "caseNumber", "patientId", "majorComplaint", symptoms, status,
         "physiotherapistId", "createdAt", "updatedAt", "createdBy")
      VALUES
        ($1, $2, $3, $4, $5, $6::"clinic_physio"."PhysioStatus",
         $7, NOW(), NOW(), $8)
      ON CONFLICT DO NOTHING
    `, c.id, c.num, c.pid, c.complaint, c.symptoms, c.status,
       PRACTITIONER_IDS.physio1, SYSTEM_USER);
  }

  // ── 8. Appointments (50 entries) ─────────────────────────────────────────────
  console.log('  Inserting appointments...');
  const baseDate = new Date('2026-05-01');
  let apptIdx = 0;

  const apptTypes = ['ASSESSMENT', 'FITTING', 'SESSION', 'FOLLOW_UP', 'COMMITTEE'];
  const apptStatuses = ['COMPLETED', 'COMPLETED', 'SCHEDULED', 'CONFIRMED', 'NO_SHOW'];
  const caseTypes = ['PROSTHETICS', 'PHYSIO', 'GENERAL'];

  for (let i = 0; i < 50 && apptIdx < APPT_IDS.length; i++, apptIdx++) {
    const dayOffset = Math.floor(i / 5); // ~5 appointments per day
    const hour = 8 + (i % 5) * 2;       // 8:00, 10:00, 12:00, 14:00, 16:00
    const apptDate = new Date(baseDate);
    apptDate.setDate(apptDate.getDate() + dayOffset);
    apptDate.setHours(hour, 0, 0, 0);
    const endDate = new Date(apptDate);
    endDate.setHours(hour + 1, 0, 0, 0);

    const patIdx = i % PATIENT_IDS.length;
    const caseType = caseTypes[i % 3];
    const caseId = i % 3 === 0
      ? PROS_CASE_IDS[i % PROS_CASE_IDS.length]
      : i % 3 === 1
        ? PHYSIO_CASE_IDS[i % PHYSIO_CASE_IDS.length]
        : null;
    const practitionerId = i % 2 === 0
      ? PRACTITIONER_IDS.prosthetist1
      : PRACTITIONER_IDS.physio1;
    const practitionerRole = i % 2 === 0 ? 'PROSTHETIST' : 'PHYSIOTHERAPIST';
    const apptType = apptTypes[i % apptTypes.length];
    const apptStatus = dayOffset < 10 ? apptStatuses[i % apptStatuses.length] : 'SCHEDULED';

    await prisma.$executeRawUnsafe(`
      INSERT INTO clinic_appointments.appointments
        (id, "patientId", "caseId", "caseType", "practitionerId", "practitionerRole",
         "appointmentType", "startTime", "endTime", "durationMinutes", status,
         "createdAt", "updatedAt", "createdBy")
      VALUES
        ($1, $2, $3, $4::"clinic_appointments"."CaseType",
         $5, $6,
         $7::"clinic_appointments"."AppointmentType",
         $8::timestamptz, $9::timestamptz, 60,
         $10::"clinic_appointments"."AppointmentStatus",
         NOW(), NOW(), $11)
      ON CONFLICT DO NOTHING
    `,
      APPT_IDS[apptIdx],
      PATIENT_IDS[patIdx],
      caseId,
      caseType,
      practitionerId,
      practitionerRole,
      apptType,
      apptDate.toISOString(),
      endDate.toISOString(),
      apptStatus,
      SYSTEM_USER,
    );
  }

  console.log('✅ Clinic demo seed complete!');
  console.log(`   Patients: ${patientData.length}`);
  console.log(`   Inventory items: ${items.length}`);
  console.log(`   Prosthetics cases: ${prostheticsCases.length}`);
  console.log(`   Physio cases: ${physioCases.length}`);
  console.log(`   Appointments: 50`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
