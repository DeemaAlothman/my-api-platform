import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const cities = [
  // دمشق
  { nameAr: 'دمشق', nameEn: 'Damascus', governorate: 'دمشق' },
  // ريف دمشق
  { nameAr: 'دوما', nameEn: 'Douma', governorate: 'ريف دمشق' },
  { nameAr: 'جرمانا', nameEn: 'Jaramana', governorate: 'ريف دمشق' },
  { nameAr: 'قدسيا', nameEn: 'Qudsaya', governorate: 'ريف دمشق' },
  { nameAr: 'صيدنايا', nameEn: 'Saidnaya', governorate: 'ريف دمشق' },
  { nameAr: 'يبرود', nameEn: 'Yabroud', governorate: 'ريف دمشق' },
  { nameAr: 'النبك', nameEn: 'Al-Nabk', governorate: 'ريف دمشق' },
  { nameAr: 'الزبداني', nameEn: 'Zabadani', governorate: 'ريف دمشق' },
  { nameAr: 'التل', nameEn: 'Al-Tal', governorate: 'ريف دمشق' },
  // حلب
  { nameAr: 'حلب', nameEn: 'Aleppo', governorate: 'حلب' },
  { nameAr: 'أعزاز', nameEn: 'Azaz', governorate: 'حلب' },
  { nameAr: 'منبج', nameEn: 'Manbij', governorate: 'حلب' },
  { nameAr: 'الباب', nameEn: 'Al-Bab', governorate: 'حلب' },
  { nameAr: 'عفرين', nameEn: 'Afrin', governorate: 'حلب' },
  // حمص
  { nameAr: 'حمص', nameEn: 'Homs', governorate: 'حمص' },
  { nameAr: 'تدمر', nameEn: 'Palmyra', governorate: 'حمص' },
  { nameAr: 'القصير', nameEn: 'Al-Qusayr', governorate: 'حمص' },
  { nameAr: 'الرستن', nameEn: 'Al-Rastan', governorate: 'حمص' },
  { nameAr: 'تلبيسة', nameEn: 'Talbisah', governorate: 'حمص' },
  // حماة
  { nameAr: 'حماة', nameEn: 'Hama', governorate: 'حماة' },
  { nameAr: 'السلمية', nameEn: 'As-Salamiyah', governorate: 'حماة' },
  { nameAr: 'مصياف', nameEn: 'Masyaf', governorate: 'حماة' },
  { nameAr: 'محردة', nameEn: 'Mahardah', governorate: 'حماة' },
  // اللاذقية
  { nameAr: 'اللاذقية', nameEn: 'Latakia', governorate: 'اللاذقية' },
  { nameAr: 'جبلة', nameEn: 'Jableh', governorate: 'اللاذقية' },
  { nameAr: 'القرداحة', nameEn: 'Al-Qardaha', governorate: 'اللاذقية' },
  // طرطوس
  { nameAr: 'طرطوس', nameEn: 'Tartus', governorate: 'طرطوس' },
  { nameAr: 'بانياس', nameEn: 'Baniyas', governorate: 'طرطوس' },
  { nameAr: 'صافيتا', nameEn: 'Safita', governorate: 'طرطوس' },
  { nameAr: 'دريكيش', nameEn: 'Duraykish', governorate: 'طرطوس' },
  // إدلب
  { nameAr: 'إدلب', nameEn: 'Idlib', governorate: 'إدلب' },
  { nameAr: 'جسر الشغور', nameEn: 'Jisr ash-Shughur', governorate: 'إدلب' },
  { nameAr: 'معرة النعمان', nameEn: "Ma'arrat al-Nu'man", governorate: 'إدلب' },
  { nameAr: 'أريحا', nameEn: 'Ariha', governorate: 'إدلب' },
  // درعا
  { nameAr: 'درعا', nameEn: "Daraa", governorate: 'درعا' },
  { nameAr: 'الصنمين', nameEn: 'As-Sanamayn', governorate: 'درعا' },
  { nameAr: 'نوى', nameEn: 'Nawa', governorate: 'درعا' },
  { nameAr: 'شهبا', nameEn: 'Shahba', governorate: 'درعا' },
  // السويداء
  { nameAr: 'السويداء', nameEn: 'As-Suwayda', governorate: 'السويداء' },
  { nameAr: 'شهبا', nameEn: 'Shahba', governorate: 'السويداء' },
  { nameAr: 'صلخد', nameEn: 'Salkhad', governorate: 'السويداء' },
  // القنيطرة
  { nameAr: 'القنيطرة', nameEn: 'Quneitra', governorate: 'القنيطرة' },
  { nameAr: 'فيق', nameEn: 'Fiq', governorate: 'القنيطرة' },
  // دير الزور
  { nameAr: 'دير الزور', nameEn: 'Deir ez-Zor', governorate: 'دير الزور' },
  { nameAr: 'الميادين', nameEn: 'Al-Mayadin', governorate: 'دير الزور' },
  { nameAr: 'البوكمال', nameEn: 'Al-Bukamal', governorate: 'دير الزور' },
  // الرقة
  { nameAr: 'الرقة', nameEn: 'Ar-Raqqah', governorate: 'الرقة' },
  { nameAr: 'الطبقة', nameEn: 'At-Tabqah', governorate: 'الرقة' },
  // الحسكة
  { nameAr: 'الحسكة', nameEn: 'Al-Hasakah', governorate: 'الحسكة' },
  { nameAr: 'القامشلي', nameEn: 'Qamishli', governorate: 'الحسكة' },
  { nameAr: 'رأس العين', nameEn: 'Ras al-Ayn', governorate: 'الحسكة' },
  { nameAr: 'المالكية', nameEn: 'Al-Malikiyah', governorate: 'الحسكة' },
];

async function main() {
  console.log('Seeding Syrian cities...');

  for (const city of cities) {
    await prisma.city.upsert({
      where: { nameAr_governorate: { nameAr: city.nameAr, governorate: city.governorate } },
      update: { nameEn: city.nameEn },
      create: city,
    });
  }

  console.log(`Seeded ${cities.length} cities successfully.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
