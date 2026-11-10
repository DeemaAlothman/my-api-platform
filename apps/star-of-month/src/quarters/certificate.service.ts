import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument, rgb } from 'pdf-lib';
import { PrismaService } from '../prisma/prisma.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkit = require('@pdf-lib/fontkit');

// ترتيب الصفحات ثابت بملف القالب: 0 = VitaXir، 1 = VitaSyr
const COMPANY_PAGE_INDEX: Record<string, number> = { VITAXIR: 0, VITASYR: 1 };

const TEMPLATE_PATH =
  process.env.CERTIFICATE_TEMPLATE_PATH || path.join(process.cwd(), 'assets', 'certificate-template.pdf');

// مواضع الحقول بالقالب (نقاط PDF) — مستخرجة من تحليل نموذج الشهادة الأصلي
const NAME_Y = 262;
const NAME_SIZE = 20;
const DATE_Y = 61;
const DATE_SIZE = 13;
const DAY_X = 600;
const MONTH_X = 563;
const YEAR_X = 500;

// مسارات خط عربي محتملة (يُثبَّت عبر Dockerfile: font-noto-arabic) — نفس نمط خدمات الفيزيو/الأطراف
const AR_FONT_CANDIDATES: string[] = [
  process.env.ARABIC_FONT_PATH || '',
  '/usr/share/fonts/noto/NotoSansArabic-Regular.ttf',
  '/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf',
  '/usr/share/fonts/TTF/NotoSansArabic-Regular.ttf',
].filter(Boolean);

function findArabicFontPath(): string {
  for (const p of AR_FONT_CANDIDATES) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* جرّب التالي */
    }
  }
  throw new Error('لا يوجد خط عربي متاح لتوليد الشهادة (ARABIC_FONT_PATH أو font-noto-arabic)');
}

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async resolveEmployeeName(employeeId: string): Promise<string> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ firstNameAr: string; lastNameAr: string }>>(
      `SELECT "firstNameAr", "lastNameAr" FROM users.employees WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1`,
      employeeId,
    );
    if (!rows.length) throw new Error('الموظف غير موجود');
    return `${rows[0].firstNameAr} ${rows[0].lastNameAr}`;
  }

  // توليد ملف PDF الشهادة — عند الطلب كل مرة (بدون تخزين)، بنفس الناتج طالما awardedAt
  // ثابت (ما بيتغيّر بإعادة التحميل)
  async generatePdf(employeeId: string, company: string, awardedAt: Date): Promise<Buffer> {
    const pageIndex = COMPANY_PAGE_INDEX[company];
    if (pageIndex === undefined) throw new Error(`شركة غير معروفة لتوليد الشهادة: ${company}`);

    const name = await this.resolveEmployeeName(employeeId);
    const templateBytes = fs.readFileSync(TEMPLATE_PATH);
    const fontBytes = fs.readFileSync(findArabicFontPath());

    const srcDoc = await PDFDocument.load(templateBytes);
    const outDoc = await PDFDocument.create();
    outDoc.registerFontkit(fontkit);

    const [embeddedPage] = await outDoc.embedPdf(srcDoc, [pageIndex]);
    const page = outDoc.addPage([embeddedPage.width, embeddedPage.height]);
    page.drawPage(embeddedPage);

    const font = await outDoc.embedFont(fontBytes, { subset: true });
    const centerX = embeddedPage.width / 2;

    const nameWidth = font.widthOfTextAtSize(name, NAME_SIZE);
    page.drawText(name, {
      x: centerX - nameWidth / 2,
      y: NAME_Y,
      size: NAME_SIZE,
      font,
      color: rgb(0.1, 0.1, 0.35),
    });

    const day = String(awardedAt.getDate()).padStart(2, '0');
    const month = String(awardedAt.getMonth() + 1).padStart(2, '0');
    const year = String(awardedAt.getFullYear());
    page.drawText(day, { x: DAY_X, y: DATE_Y, size: DATE_SIZE, font, color: rgb(0, 0, 0) });
    page.drawText(month, { x: MONTH_X, y: DATE_Y, size: DATE_SIZE, font, color: rgb(0, 0, 0) });
    page.drawText(year, { x: YEAR_X, y: DATE_Y, size: DATE_SIZE, font, color: rgb(0, 0, 0) });

    const bytes = await outDoc.save();
    return Buffer.from(bytes);
  }

  // تحقّق التوليد ناجح وقت حسم نجم الربع — ما بيخزّن الملف، بس يسجّل وقت أول توليد ناجح
  async verifyGeneratable(employeeId: string, company: string, awardedAt: Date): Promise<boolean> {
    try {
      await this.generatePdf(employeeId, company, awardedAt);
      return true;
    } catch (err) {
      this.logger.error(`certificate generation check failed for ${employeeId}/${company}: ${(err as any)?.message}`);
      return false;
    }
  }
}
