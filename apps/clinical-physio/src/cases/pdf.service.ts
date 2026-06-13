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
      row('Previous Injury', c.hadPreviousInjury);

      // ── Medical Team ──────────────────────────────────────────────────
      section('Medical Team');
      row('Physiotherapist ID', c.physiotherapistId);
      row('Supervising Doctor ID', c.supervisingDoctorId);
      row('Case Manager ID', c.caseManagerId);

      // ── Symptoms & Pain ───────────────────────────────────────────────
      if (c.symptoms?.length || c.painTypes?.length) {
        section('Symptoms & Pain Profile');
        if (c.symptoms?.length) row('Symptoms', c.symptoms);
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

  // تقرير الملخص النهائي: بيانات المريض + قائمة كل الجلسات + الملخص النهائي
  async generateFinalSummaryReport(c: any): Promise<Buffer> {
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
        .text('FINAL TREATMENT SUMMARY', 50, 58, { width: W, align: 'center' });
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(
          `Case No: ${c.caseNumber}    |    Generated: ${new Date().toLocaleDateString('en-GB')}`,
          50, 82, { width: W, align: 'center' },
        );

      doc.fillColor(dark).moveDown(3.5);

      const section = (title: string) => {
        doc
          .moveDown(0.5).fontSize(11).font('Helvetica-Bold').fillColor(accent)
          .text(title.toUpperCase());
        doc.moveTo(50, doc.y).lineTo(50 + W, doc.y).strokeColor(accent).lineWidth(0.5).stroke();
        doc.moveDown(0.4).fillColor(dark).fontSize(10).font('Helvetica');
      };

      const row = (label: string, value: any) => {
        if (value === null || value === undefined || value === '') return;
        doc
          .font('Helvetica-Bold').fillColor(gray)
          .text(`${label}:`, 50, doc.y, { continued: true, width: 160 })
          .font('Helvetica').fillColor(dark).text(` ${String(value)}`);
      };

      // أدوات مساعدة إضافية
      const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString('en-GB') : null);
      const list = (label: string, arr: any) => {
        if (Array.isArray(arr) && arr.length) row(label, arr.join(', '));
      };
      const yesNo = (label: string, val: any, detail?: any) => {
        if (val === true) row(label, detail ? `Yes — ${detail}` : 'Yes');
      };
      const text = (value: any) => {
        if (value === null || value === undefined || value === '') return;
        doc.font('Helvetica').fillColor(dark).fontSize(10).text(String(value), { width: W, align: 'left' });
      };
      // تلخيص خيارات عضو التقييم الوضعي (JSON) → نص بالخيارات المختارة فقط
      const flattenRegion = (obj: any): string => {
        if (!obj || typeof obj !== 'object') return '';
        const parts: string[] = [];
        for (const [k, v] of Object.entries(obj)) {
          if (v === true) parts.push(k);
          else if (v && typeof v === 'object') {
            const sides: string[] = [];
            if ((v as any).L) sides.push('L');
            if ((v as any).R) sides.push('R');
            if (sides.length) parts.push(`${k}(${sides.join('/')})`);
          } else if (typeof v === 'string' && v.trim()) {
            parts.push(`${k}: ${v}`);
          }
        }
        return parts.join(', ');
      };

      // ── Patient ───────────────────────────────────────────────────────
      section('Patient');
      const p = c.patient;
      if (p) {
        row('Name', `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim());
        row('Patient No', p.patientNumber);
        row('ID Number', p.idNumber);
      }
      row('Patient ID', c.patientId);
      row('Case No', c.caseNumber);
      row('Status', c.status);
      row('Physiotherapist ID', c.physiotherapistId);
      row('Supervising Doctor ID', c.supervisingDoctorId);
      row('Case Manager ID', c.caseManagerId);

      // ── Complaint (الشكوى) ────────────────────────────────────────────
      section('Medical Complaint');
      row('Complaint Type', c.complaintType);
      row('Major Complaint', c.majorComplaint);
      row('Symptoms', c.symptoms);
      row('Pain Location', c.painLocation);
      row('Duration', c.complaintDuration);
      row('Current Job', c.currentJob);
      row('Life Type', c.lifeType);
      row('Complaint Start', fmtDate(c.complaintStartDate));
      row('Possible Cause', c.possibleCause);
      yesNo('Chronic Diseases', c.hasChronicDiseases, c.chronicDiseasesDetail);
      yesNo('Visited Specialist', c.visitedSpecialist, c.previousDoctorSeen);
      yesNo('Previous Physical Therapy', c.hadPreviousPT, c.previousTreatment);
      row('Previous Injury', c.hadPreviousInjury);
      yesNo('Previous Surgery', c.hadSurgery, c.surgeryDetail);
      row('Complaint Notes', c.complaintNotes);

      // ── Pain Profile & Pain Map ───────────────────────────────────────
      section('Pain Profile');
      row('Pain Level', c.painLevel);
      row('Pain Duration', c.painDuration);
      row('Pain Start', fmtDate(c.painStartDate));
      row('Pain Progression', c.painProgression);
      row('Best Time of Day', c.bestTimeOfDay);
      row('Worst Time of Day', c.worstTimeOfDay);
      list('Pain Types', c.painTypes);
      row('Pain Type (Other)', c.painTypeOther);
      list('Aggravating Factors', c.aggravatingFactors);
      row('Aggravating (Other)', c.aggravatingOther);
      list('Alleviating Factors', c.alleviatingFactors);
      row('Alleviating (Other)', c.alleviatingOther);
      if (c.painMap) {
        row('Pain Map Notes', c.painMap.notes);
      }

      // ── Medical History ───────────────────────────────────────────────
      const mh = c.medicalHistory;
      if (mh) {
        section('Medical History');
        yesNo('Smokes', mh.smokes, mh.smokingFrequency);
        yesNo('Has Smoked Before', mh.hasSmokedBefore);
        yesNo('Pacemaker', mh.hasPacemaker, mh.pacemakerDetail);
        yesNo('Other Health Problems', mh.hasOtherHealthProblems, mh.otherConditions);
        yesNo('Prescription/OTC Drugs', mh.prescriptionDrugs, mh.currentMedications);
        yesNo('Herbal/Vitamins', mh.herbalSupplements, mh.supplementsList);
        yesNo('Allergy (adhesive/latex/bee)', mh.adhesiveAllergy, mh.allergies);
        yesNo('Pregnant', mh.isPregnant);
        row('Previous Diagnoses', mh.previousDiagnoses);
        list('Chronic Conditions', mh.chronicConditions);
        row('Doctor Restrictions', mh.doctorRestrictions);
        row('Previous Complaints/Surgeries', mh.previousComplaintsSurgeries);
        yesNo('PT for Same Problem', mh.hadPTSameProblem, mh.ptSameProblemDetail);
        yesNo('Receiving Other Treatment', mh.receivingOtherTreatment, mh.otherTreatmentDetail);
        list('Tests Had', mh.testsHad);
        row('Tests (Other)', mh.testsOther);
        row('Test Results', mh.testResults);
        row('New Analysis', mh.newAnalysis ? `${mh.newAnalysis}${mh.newAnalysisDate ? ' (' + fmtDate(mh.newAnalysisDate) + ')' : ''}` : null);
        row('Old Analysis', mh.oldAnalysis ? `${mh.oldAnalysis}${mh.oldAnalysisDate ? ' (' + fmtDate(mh.oldAnalysisDate) + ')' : ''}` : null);
        yesNo('Bone Density Test', mh.boneDensityTest, mh.boneDensityDetail);
        yesNo('Hospitalized (past year)', mh.hospitalizedLastYear, mh.hospitalizedDetail);
        if (Array.isArray(mh.surgeries) && mh.surgeries.length) {
          mh.surgeries.forEach((s: any, i: number) =>
            row(`Surgery ${i + 1}`, `${s.name ?? ''}${s.date ? ' — ' + fmtDate(s.date) : ''}${s.type ? ' (' + s.type + ')' : ''}`.trim()),
          );
        }
      }

      // ── Evaluation (Notes & Evaluation) ───────────────────────────────
      const ev = c.evaluation;
      if (ev && (ev.modalities?.length || ev.notes || ev.evaluation || ev.otherModality)) {
        section('Notes & Evaluation');
        list('Modalities', ev.modalities);
        row('Modality (Other)', ev.otherModality);
        row('Notes', ev.notes);
        row('Evaluation', ev.evaluation);
      }

      // ── Treatment Goals ───────────────────────────────────────────────
      const g = c.treatmentGoals;
      if (g) {
        section('Treatment Goals');
        list('Goals', g.goals);
        row('Custom Goal', g.customGoal);
        yesNo('Decrease Pain', g.decreasePain);
        yesNo('Improve Strength', g.improveStrength);
        yesNo('Less Difficulty at Work', g.lessDifficultyWork);
        yesNo('Improve Movement', g.improveMovement);
        row('Stand Longer (min)', g.standLongerMinutes);
        row('Sleep Longer (min)', g.sleepLongerMinutes);
        row('Sit Longer (min)', g.sitLongerMinutes);
        row('Other Goals', g.otherGoals);
      }

      // ── Postural Assessment ───────────────────────────────────────────
      const pa = c.posturalAssessment;
      if (pa) {
        section('Postural Assessment');
        row('Seated Position', pa.seatedPosition);
        row('Trunk Control', pa.trunkControl);
        row('Head', flattenRegion(pa.head));
        row('Shoulders', flattenRegion(pa.shoulders));
        row('Elbow', flattenRegion(pa.elbow));
        row('Rib Cage', flattenRegion(pa.ribCage));
        row('Spine', flattenRegion(pa.spine));
        row('Pelvis', flattenRegion(pa.pelvis));
        row('Hips', flattenRegion(pa.hips));
        row('Knees', flattenRegion(pa.knees));
        row('Feet', flattenRegion(pa.feet));
        row('Spasticity/Reflexes/Tone', pa.spasticityNotes);
        row('Comments', pa.generalNotes);
        row('Diagnosis', pa.diagnosis);
      }

      // ── Treatment Plan ────────────────────────────────────────────────
      const tp = c.treatmentPlan;
      if (tp) {
        section('Treatment Plan');
        row('From', fmtDate(c.treatmentFrom));
        row('To', fmtDate(c.treatmentTo));
        row('Anticipated Visits', c.anticipatedVisits);
        list('Modalities', tp.modalities);
        row('Modality (Other)', tp.otherModality);
        row('Remarks', tp.remarks);
        row('Observation', tp.observation);
        row('Plan Status', tp.status);
      }

      // ── Sessions ──────────────────────────────────────────────────────
      const sessions = Array.isArray(c.sessions) ? c.sessions : [];
      section(`Sessions (${sessions.length})`);
      if (sessions.length === 0) {
        doc.font('Helvetica').fillColor(gray).text('  No sessions recorded.');
      } else {
        sessions.forEach((s: any) => {
          const num = s.sessionNumber ?? '-';
          const date = s.sessionDate ? new Date(s.sessionDate).toLocaleDateString('en-GB') : '';
          const time = s.sessionTime ? ` ${s.sessionTime}` : '';
          row(`Session ${num}`, `${date}${time}${s.notes ? '  —  ' + s.notes : ''}`);
          if (s.supervisorOpinion) row('   Dept. Head Opinion', s.supervisorOpinion);
          if (s.doctorDecision) row('   Doctor Decision', s.doctorDecision);
        });
      }

      // ── Final Summary ─────────────────────────────────────────────────
      section('Final Summary');
      text(c.finalSummary || '—');

      // ── Footer ────────────────────────────────────────────────────────
      const pageHeight = doc.page.height;
      doc
        .moveTo(50, pageHeight - 60).lineTo(50 + W, pageHeight - 60)
        .strokeColor('#cccccc').lineWidth(0.5).stroke();
      doc
        .fontSize(8).fillColor(gray)
        .text(
          `This document is confidential and intended for authorized personnel only.  |  ${new Date().toISOString()}`,
          50, pageHeight - 48, { width: W, align: 'center' },
        );

      doc.end();
    });
  }
}
