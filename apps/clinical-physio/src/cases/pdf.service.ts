import { Injectable } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');

@Injectable()
export class PdfService {
  async generateCaseReport(c: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = 595 - 100;
      const gray = '#555555';
      const dark = '#1a1a2e';
      const accent = '#1a7a4a';

      // ── Header ────────────────────────────────────────────────────────
      doc.rect(50, 40, W, 70).fill(accent);
      doc
        .fillColor('white')
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('PHYSIOTHERAPY CASE REPORT', 50, 58, { width: W, align: 'center' });
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(
          `Case No: ${c.caseNumber}    |    Generated: ${new Date().toLocaleDateString('en-GB')}`,
          50,
          82,
          { width: W, align: 'center' },
        );

      doc.fillColor(dark).moveDown(3.5);

      const section = (title: string) => {
        doc
          .moveDown(0.5)
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
        if (value === null || value === undefined || value === '') return;
        doc
          .font('Helvetica-Bold')
          .fillColor(gray)
          .text(`${label}:`, 50, doc.y, { continued: true, width: 160 })
          .font('Helvetica')
          .fillColor(dark)
          .text(` ${String(value)}`);
      };

      // ── Case Information ──────────────────────────────────────────────
      section('Case Information');
      row('Patient ID', c.patientId);
      row('Status', c.status);
      row('Major Complaint', c.majorComplaint);
      row('Life Type', c.lifeType);
      row('Pain Level', c.painLevel);
      row('Pain Duration', c.painDuration);
      row('Treatment From', c.treatmentFrom ? new Date(c.treatmentFrom).toLocaleDateString('en-GB') : null);
      row('Treatment To', c.treatmentTo ? new Date(c.treatmentTo).toLocaleDateString('en-GB') : null);
      row('Anticipated Visits', c.anticipatedVisits);
      if (c.hadPreviousPT) row('Previous PT', 'Yes');
      if (c.hadPreviousInjury) row('Previous Injury', 'Yes');

      // ── Medical Team ──────────────────────────────────────────────────
      section('Medical Team');
      row('Physiotherapist ID', c.physiotherapistId);
      row('Supervising Doctor ID', c.supervisingDoctorId);
      row('Case Manager ID', c.caseManagerId);

      // ── Symptoms & Pain ───────────────────────────────────────────────
      if (c.symptoms?.length || c.painTypes?.length) {
        section('Symptoms & Pain Profile');
        if (c.symptoms?.length) row('Symptoms', c.symptoms.join(', '));
        if (c.painTypes?.length) row('Pain Types', c.painTypes.join(', '));
        if (c.aggravatingFactors?.length) row('Aggravating Factors', c.aggravatingFactors.join(', '));
        if (c.alleviatingFactors?.length) row('Alleviating Factors', c.alleviatingFactors.join(', '));
      }

      // ── Supervisor Review ─────────────────────────────────────────────
      if (c.supervisorReview) {
        section('Supervisor Review');
        row('Reviewed At', c.supervisorReview.reviewedAt
          ? new Date(c.supervisorReview.reviewedAt).toLocaleDateString('en-GB')
          : null);
        row('Notes', c.supervisorReview.notes);
      }

      // ── Treatment Plan ────────────────────────────────────────────────
      if (c.treatmentPlan) {
        section('Treatment Plan');
        row('Plan Signed', c.treatmentPlan.signedAt
          ? `Yes — ${new Date(c.treatmentPlan.signedAt).toLocaleDateString('en-GB')}`
          : 'Pending');
        row('Goals', Array.isArray(c.treatmentPlan.goals)
          ? c.treatmentPlan.goals.join(', ')
          : c.treatmentPlan.goals);
      }

      // ── Sessions ──────────────────────────────────────────────────────
      if (c.sessions?.length) {
        section(`Therapy Sessions (${c.sessions.length})`);
        c.sessions.slice(0, 10).forEach((s: any, i: number) => {
          row(
            `${i + 1}. ${new Date(s.sessionDate).toLocaleDateString('en-GB')}`,
            `${s.sessionType ?? ''} — ${s.notes ?? 'Completed'}`.trim(),
          );
        });
        if (c.sessions.length > 10) {
          doc.font('Helvetica').fillColor(gray)
            .text(`  ... and ${c.sessions.length - 10} more sessions`);
        }
      }

      // ── Footer ────────────────────────────────────────────────────────
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
        .text(
          `This document is confidential and intended for authorized personnel only.  |  ${new Date().toISOString()}`,
          50,
          pageHeight - 48,
          { width: W, align: 'center' },
        );

      doc.end();
    });
  }
}
