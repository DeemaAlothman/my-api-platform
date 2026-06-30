import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDonorReport(from?: string, to?: string) {
    const where: any = { deletedAt: null };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [
      totalCases,
      casesByStatus,
      uniquePatients,
      totalComponents,
      totalConsumables,
      followUps,
      deliveries,
      casesByType,
    ] = await Promise.all([
      this.prisma.prostheticsCase.count({ where }),
      this.prisma.prostheticsCase.groupBy({
        by: ['status' as any],
        where,
        _count: { id: true },
      }),
      this.prisma.prostheticsCase.findMany({
        where,
        select: { patientId: true },
        distinct: ['patientId' as any],
      }),
      this.prisma.prosthesisComponent.count({
        where: { case: { deletedAt: null, ...where } },
      }),
      this.prisma.consumableUsage.count({
        where: { case: { deletedAt: null, ...where } },
      }),
      this.prisma.followUp.count({
        where: { case: { deletedAt: null, ...where } },
      }),
      this.prisma.prostheticsCase.count({
        where: { ...where, status: 'DELIVERED' },
      }),
      this.prisma.prostheticsCase.findMany({
        where,
        select: { amputationType: true },
      }),
    ]);

    const byStatus = (casesByStatus as any[]).map((s) => ({
      status: s.status,
      count: s._count.id,
    }));

    // amputationType مصفوفة الآن (حالة ممكن تشمل بتر علوي وسفلي سوا) — نعدّ كل نوع على حدة
    const amputationTypeCounts = new Map<string, number>();
    for (const c of casesByType as unknown as Array<{ amputationType: string[] }>) {
      for (const t of c.amputationType ?? []) {
        amputationTypeCounts.set(t, (amputationTypeCounts.get(t) ?? 0) + 1);
      }
    }
    const byAmputationType = [...amputationTypeCounts.entries()].map(([type, count]) => ({ type, count }));

    const successRate =
      totalCases > 0 ? Math.round((deliveries / totalCases) * 100) : 0;

    return {
      period: { from: from ?? null, to: to ?? null },
      summary: {
        totalCases,
        patientsServed: uniquePatients.length,
        deliveredCases: deliveries,
        successRate,
        followUpsCompleted: followUps,
      },
      byStatus,
      byAmputationType,
      resources: {
        totalComponentsUsed: totalComponents,
        totalConsumablesUsed: totalConsumables,
      },
      generatedAt: new Date(),
    };
  }

  async getDonorReportPdf(from?: string, to?: string): Promise<Buffer> {
    const data = await this.getDonorReport(from, to);
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = 595 - 100;
      const accent = '#2e6da4';
      const dark = '#1a1a2e';
      const gray = '#555555';

      // ── Header ──────────────────────────────────────────────────────
      doc.rect(50, 40, W, 80).fill(accent);
      doc
        .fillColor('white')
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('DONOR IMPACT REPORT', 50, 55, { width: W, align: 'center' });
      doc.fontSize(10).font('Helvetica').text('Clinical Prosthetics Program', 50, 82, {
        width: W,
        align: 'center',
      });
      const periodLabel =
        data.period.from || data.period.to
          ? `${data.period.from ?? 'Beginning'} — ${data.period.to ?? 'Present'}`
          : 'All Time';
      doc.text(`Period: ${periodLabel}`, 50, 96, { width: W, align: 'center' });

      doc.fillColor(dark).moveDown(4);

      // ── Summary Cards ────────────────────────────────────────────────
      const cardY = doc.y;
      const cardW = (W - 30) / 4;
      const cards = [
        { label: 'Total Cases', value: data.summary.totalCases },
        { label: 'Patients Served', value: data.summary.patientsServed },
        { label: 'Cases Delivered', value: data.summary.deliveredCases },
        { label: 'Success Rate', value: `${data.summary.successRate}%` },
      ];
      cards.forEach((card, i) => {
        const x = 50 + i * (cardW + 10);
        doc.rect(x, cardY, cardW, 60).fill('#f0f4f8');
        doc
          .fillColor(accent)
          .fontSize(22)
          .font('Helvetica-Bold')
          .text(String(card.value), x, cardY + 8, { width: cardW, align: 'center' });
        doc
          .fillColor(gray)
          .fontSize(9)
          .font('Helvetica')
          .text(card.label, x, cardY + 36, { width: cardW, align: 'center' });
      });

      doc.fillColor(dark).moveDown(5.5);

      // ── Section helper ───────────────────────────────────────────────
      const section = (title: string) => {
        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor(accent)
          .text(title.toUpperCase());
        doc
          .moveTo(50, doc.y)
          .lineTo(50 + W, doc.y)
          .strokeColor(accent)
          .lineWidth(0.5)
          .stroke();
        doc.moveDown(0.4).fillColor(dark).fontSize(10).font('Helvetica');
      };

      const row = (label: string, value: any) => {
        doc
          .font('Helvetica-Bold')
          .fillColor(gray)
          .text(`${label}:`, 50, doc.y, { continued: true, width: 200 })
          .font('Helvetica')
          .fillColor(dark)
          .text(` ${String(value)}`);
      };

      // ── Cases by Status ──────────────────────────────────────────────
      section('Cases by Status');
      if (data.byStatus.length === 0) {
        doc.text('No cases found for this period.');
      } else {
        data.byStatus.forEach((s) => row(s.status, s.count));
      }

      // ── Amputation Types ─────────────────────────────────────────────
      if (data.byAmputationType?.length) {
        doc.moveDown(0.5);
        section('Cases by Amputation Type');
        data.byAmputationType.forEach((s: any) => row(s.type ?? 'Unknown', s.count));
      }

      // ── Resources Used ───────────────────────────────────────────────
      doc.moveDown(0.5);
      section('Resources Used');
      row('Prosthetic Components', data.resources.totalComponentsUsed);
      row('Consumable Items', data.resources.totalConsumablesUsed);

      // ── Follow-Ups ───────────────────────────────────────────────────
      doc.moveDown(0.5);
      section('Patient Follow-Up');
      row('Total Follow-Up Visits', data.summary.followUpsCompleted);

      // ── Note ─────────────────────────────────────────────────────────
      doc.moveDown(1.5);
      doc
        .fontSize(9)
        .fillColor(gray)
        .font('Helvetica-BoldOblique')
        .text(
          'This report is generated automatically from the clinical management system. ' +
            'All data reflects confirmed records as of the generation date.',
          { align: 'justify' },
        );

      // ── Footer ───────────────────────────────────────────────────────
      const pageHeight = doc.page.height;
      doc
        .moveTo(50, pageHeight - 60)
        .lineTo(50 + W, pageHeight - 60)
        .strokeColor('#cccccc')
        .lineWidth(0.5)
        .stroke();
      doc
        .fontSize(8)
        .fillColor(gray)
        .font('Helvetica')
        .text(
          `CONFIDENTIAL — For Authorized Donors Only  |  Generated: ${new Date().toISOString()}`,
          50,
          pageHeight - 48,
          { width: W, align: 'center' },
        );

      doc.end();
    });
  }
}
