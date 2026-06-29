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

      const W = 595 - 100; // usable width
      const gray = '#555555';
      const dark = '#1a1a2e';
      const accent = '#2e6da4';

      // ── Header ────────────────────────────────────────────────────────
      doc.rect(50, 40, W, 70).fill(accent);
      doc
        .fillColor('white')
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('PROSTHETICS CASE REPORT', 50, 58, { width: W, align: 'center' });
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

      // ── Section helper ────────────────────────────────────────────────
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
      row('Prosthesis Type', c.prosthesisType);
      row('Amputation Type', c.amputationType);
      row('Amputation Side', c.amputationSide);
      row('Amputation Level', c.amputationLevel);
      row('Amputation Date', c.amputationDate ? new Date(c.amputationDate).toLocaleDateString('en-GB') : null);
      row('Amputation Cause', c.amputationCause);
      row('Amputation Count', c.amputationCount);
      if (c.hasPreviousProsthesis) row('Previous Prosthesis', c.previousProsthesisDetails ?? 'Yes');
      if (c.hasChronicDiseases) row('Chronic Diseases', c.chronicDiseases ?? 'Yes');

      // ── Medical Team ──────────────────────────────────────────────────
      section('Medical Team');
      row('Prosthetist ID', c.prosthetistId);
      row('Physiotherapist ID', c.physiotherapistId);
      row('Supervising Doctor ID', c.supervisingDoctorId);
      row('Workshop Supervisor ID', c.workshopSupervisorId);

      // ── Assessment ────────────────────────────────────────────────────
      if ((c.upperAssessment && c.upperAssessment.length > 0) || c.lowerAssessment) {
        section('Assessment');
        for (const ua of c.upperAssessment ?? []) {
          row(`Upper Limb Assessment (${ua.side})`, `Completed on ${new Date(ua.examinedAt).toLocaleDateString('en-GB')}`);
        }
        if (c.lowerAssessment) {
          row('Lower Limb Assessment', `Completed on ${new Date(c.lowerAssessment.examinedAt || c.lowerAssessment.createdAt).toLocaleDateString('en-GB')}`);
        }
      }

      // ── Committee ─────────────────────────────────────────────────────
      if (c.committeeReview) {
        section('Committee Review');
        row('Final Decision', c.committeeReview.finalDecision);
        row('Decision Date', c.committeeReview.decisionDate
          ? new Date(c.committeeReview.decisionDate).toLocaleDateString('en-GB')
          : null);
      }

      // ── Components ────────────────────────────────────────────────────
      if (c.components?.length) {
        section(`Components (${c.components.length} items)`);
        let totalCost = 0;
        c.components.forEach((comp: any, i: number) => {
          const cost = comp.costUsd ?? comp.unitCostUsd ?? 0;
          totalCost += Number(cost);
          row(
            `${i + 1}. ${comp.componentName ?? comp.inventoryItemId}`,
            cost ? `$${Number(cost).toFixed(2)} USD` : 'N/A',
          );
        });
        if (totalCost > 0) {
          doc.moveDown(0.3).font('Helvetica-Bold').fillColor(accent)
            .text(`Total Components Cost: $${totalCost.toFixed(2)} USD`);
          doc.fillColor(dark).font('Helvetica');
        }
      }

      // ── Treatment Sessions ────────────────────────────────────────────
      if (c.treatmentPlan) {
        section('Treatment Sessions');
        row('Workshop Sessions', c.treatmentPlan.workshopSessions?.length ?? 0);
        row('PT Sessions', c.treatmentPlan.ptSessions?.length ?? 0);
        row('Media Sessions', c.treatmentPlan.mediaSessions?.length ?? 0);
      }

      // ── Gait / Balance ────────────────────────────────────────────────
      if (c.gaitAnalysis || c.balanceAssessment) {
        section('Functional Evaluation');
        if (c.gaitAnalysis) row('Gait Analysis', 'Completed');
        if (c.balanceAssessment) row('Balance Assessment', 'Completed');
      }

      // ── Final Evaluation & Delivery ───────────────────────────────────
      if (c.finalEvaluation || c.delivery) {
        section('Outcome');
        if (c.finalEvaluation) row('Final Evaluation', 'Completed');
        if (c.delivery) {
          row('Delivery Date', c.delivery.deliveryDate
            ? new Date(c.delivery.deliveryDate).toLocaleDateString('en-GB')
            : 'Pending');
        }
      }

      // ── Follow-Ups ────────────────────────────────────────────────────
      if (c.followUps?.length) {
        section(`Follow-Up Visits (${c.followUps.length})`);
        c.followUps.slice(0, 5).forEach((f: any) => {
          row(new Date(f.visitDate).toLocaleDateString('en-GB'), f.notes ?? 'Completed');
        });
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
