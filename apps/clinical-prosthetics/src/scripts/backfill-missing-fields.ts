/**
 * تعبئة الحقول الناقصة للحالات الموجودة — يُشغَّل مرة واحدة يدوياً.
 *
 * يحسب الحقول الإجبارية الفارغة لكل حالة ويكتب hasMissingFields و missingFields
 * عليها فقط. لا يعدّل ولا يحذف أي حقل آخر، ولا يلمس أي جدول غير prosthetics_cases.
 * آمن لإعادة التشغيل: يعيد الحساب من الصفر في كل مرة.
 *
 *   node dist/apps/clinical-prosthetics/src/scripts/backfill-missing-fields.js           (تجربة — يطبع فقط)
 *   node dist/apps/clinical-prosthetics/src/scripts/backfill-missing-fields.js --apply   (تنفيذ)
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CasesService } from '../cases/cases.service';
import { PrismaService } from '../prisma/prisma.service';

async function main() {
  const apply = process.argv.includes('--apply');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const cases = app.get(CasesService);
  const prisma = app.get(PrismaService);

  try {
    const all = await prisma.prostheticsCase.findMany({
      where: { deletedAt: null },
      select: { id: true, caseNumber: true },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`${all.length} حالة${apply ? ' — تنفيذ' : ' — تجربة جافة، لن يُكتب شيء'}`);

    let incomplete = 0;
    let complete = 0;
    let failed = 0;

    for (const c of all) {
      let missing: Array<{ section: string; field: string }> | null = null;
      try {
        missing = await cases.computeMissingFields(c.id);
      } catch (err) {
        failed++;
        console.log(`  ✗ ${c.caseNumber}: تعذّر الحساب — ${(err as any)?.message ?? err}`);
        continue;
      }

      if (missing.length > 0) incomplete++; else complete++;

      if (apply) {
        await prisma.prostheticsCase.update({
          where: { id: c.id },
          data: {
            hasMissingFields: missing.length > 0,
            missingFields: missing as any,
            missingFieldsAt: new Date(),
          },
        });
      }

      if (missing.length > 0) {
        const bySection = missing.reduce<Record<string, number>>((acc, m) => {
          acc[m.section] = (acc[m.section] ?? 0) + 1;
          return acc;
        }, {});
        const summary = Object.entries(bySection).map(([s, n]) => `${s}:${n}`).join('، ');
        console.log(`  • ${c.caseNumber}: ${missing.length} حقل ناقص (${summary})`);
      }
    }

    console.log('');
    console.log(`ناقصة: ${incomplete} | مكتملة: ${complete} | تعذّر حسابها: ${failed}`);
    if (!apply) console.log('لم يُكتب شيء. أعد التشغيل مع --apply للتنفيذ.');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
