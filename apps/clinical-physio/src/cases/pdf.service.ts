import { Injectable } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');

// تشكيل العربي (إن توفّرت المكتبة) — مع احتياطي يرجّع النص كما هو
let _reshaper: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _reshaper = require('arabic-reshaper');
} catch {
  _reshaper = null;
}
const isArabic = (s: any) => /[؀-ۿ]/.test(String(s ?? ''));
function shapeArabic(s: any): string {
  const str = String(s ?? '');
  if (!isArabic(str)) return str;
  let out = str;
  try {
    if (_reshaper?.convertArabic) out = _reshaper.convertArabic(str);
    else if (_reshaper?.reshape) out = _reshaper.reshape(str);
    else if (typeof _reshaper === 'function') out = _reshaper(str);
  } catch {
    /* تجاهل — نرجّع النص الأصلي */
  }
  // عكس الترتيب لعرض RTL على محرّك LTR
  return out.split('').reverse().join('');
}
// مسارات خط عربي محتملة (يُثبَّت عبر Dockerfile: font-noto-arabic)
const AR_FONT_CANDIDATES: string[] = [
  process.env.ARABIC_FONT_PATH || '',
  '/usr/share/fonts/noto/NotoSansArabic-Regular.ttf',
  '/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf',
  '/usr/share/fonts/TTF/NotoSansArabic-Regular.ttf',
].filter(Boolean);
function registerArabicFont(doc: any): boolean {
  for (const p of AR_FONT_CANDIDATES) {
    try {
      if (fs.existsSync(p)) {
        doc.registerFont('AR', p);
        return true;
      }
    } catch {
      /* جرّب التالي */
    }
  }
  return false;
}

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

  // التقرير النهائي — بشكل النموذج الورقي (بانرات + مربعات) ببيانات المريض
  async generateFinalSummaryReport(c: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const M = 40;
      const doc = new PDFDocument({ margin: M, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = 595 - M * 2;
      const gray = '#555555';
      const dark = '#1a1a2e';
      const purple = '#5b1a4d';
      const hasAr = registerArabicFont(doc);
      const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString('en-GB') : '');

      const pageBreak = (need = 30) => {
        if (doc.y > 800 - need) doc.addPage();
      };
      // بانر قسم بنفسجي (إنجليزي يسار + عربي يمين إن توفّر الخط)
      const banner = (en: string, ar?: string) => {
        if (doc.y > 760) doc.addPage();
        const y = doc.y + 8;
        doc.rect(M, y, W, 22).fill(purple);
        doc.fillColor('white').font('Helvetica-Bold').fontSize(11).text(en, M + 6, y + 6, { width: W - 12, align: 'left' });
        if (ar && hasAr) doc.font('AR').fontSize(11).text(shapeArabic(ar), M + 6, y + 6, { width: W - 12, align: 'right' });
        doc.y = y + 30;
        doc.fillColor(dark).font('Helvetica').fontSize(9);
      };
      // قيمة (تدعم العربي)
      const putValue = (v: string) => {
        if (isArabic(v) && hasAr) doc.font('AR').fillColor(dark).text(shapeArabic(v));
        else doc.font('Helvetica').fillColor(dark).text(v);
      };
      const row = (label: string, value: any) => {
        if (value === null || value === undefined || value === '') return;
        pageBreak();
        doc.font('Helvetica-Bold').fillColor(gray).fontSize(9).text(`${label}: `, M + 4, doc.y, { continued: true, width: W - 8 });
        putValue(String(value));
      };
      const list = (label: string, arr: any) => {
        if (Array.isArray(arr) && arr.length) row(label, arr.join(', '));
      };
      // سؤال نعم/لا → [x] Yes  [ ] No
      const yn = (label: string, val: any, detail?: any) => {
        pageBreak();
        doc.font('Helvetica-Bold').fillColor(gray).fontSize(9).text(`${label}:  `, M + 4, doc.y, { continued: true, width: W - 8 });
        doc.font('Helvetica').fillColor(dark).text(`${val === true ? '[x]' : '[ ]'} Yes    ${val === false ? '[x]' : '[ ]'} No`);
        if (val === true && detail) row('    Details', detail);
      };
      // قائمة مربعات: كل الخيارات مع [x] للمختار
      const checks = (label: string, options: string[][], selected: any) => {
        const sel: string[] = Array.isArray(selected) ? selected : (selected != null && selected !== '' ? [selected] : []);
        pageBreak();
        doc.font('Helvetica-Bold').fillColor(gray).fontSize(9).text(`${label}:`, M + 4, doc.y, { width: W - 8 });
        doc.font('Helvetica').fillColor(dark).fontSize(9)
          .text(options.map(([k, lbl]) => `${sel.includes(k) ? '[x]' : '[ ]'} ${lbl}`).join('    '), M + 8, doc.y, { width: W - 12 });
        doc.moveDown(0.3);
      };
      const text = (value: any) => {
        pageBreak();
        const v = value === null || value === undefined || value === '' ? '—' : String(value);
        if (isArabic(v) && hasAr) doc.font('AR').fillColor(dark).fontSize(10).text(shapeArabic(v), M + 4, doc.y, { width: W - 8 });
        else doc.font('Helvetica').fillColor(dark).fontSize(10).text(v, M + 4, doc.y, { width: W - 8 });
      };
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
          } else if (typeof v === 'string' && v.trim()) parts.push(`${k}: ${v}`);
        }
        return parts.join(', ');
      };

      // قوائم الخيارات (مطابقة للنموذج)
      const PAIN_TYPES = [['NUMBNESS', 'Numbness'], ['DULL_ACHE', 'Dull Ache'], ['HOT_BURNING', 'Hot Burning'], ['SHARP_STABBING', 'Sharp Stabbing'], ['PINS', 'Pins'], ['OTHER', 'Other']];
      const FACTORS = [['SITTING', 'Sitting'], ['HEAT', 'Heat'], ['COLD', 'Cold'], ['COUGHING', 'Coughing'], ['WALKING', 'Walking'], ['EXERCISE', 'Exercise'], ['LYING_DOWN', 'Lying Down'], ['OTHER', 'Other']];
      const PAIN_LEVEL = [['MILD', 'Mild'], ['MODERATE', 'Moderate'], ['SEVERE', 'Severe'], ['EXCRUCIATING', 'Excruciating']];
      const PAIN_DUR = [['INTERMITTENT', 'Intermittent'], ['CONSTANT', 'Constant'], ['WITH_CERTAIN_MOTIONS', 'With certain motions']];
      const LIFE = [['SEDENTARY', 'Sedentary'], ['NORMAL', 'Normal'], ['ABNORMAL', 'Abnormal'], ['PROFESSIONAL', 'Professional']];
      const MODALITIES = [['MANUAL_THERAPY', 'Manual Therapy'], ['MASSAGE', 'Massage'], ['KINESIO_TAPING', 'Kinesio Taping'], ['COMPRESSION', 'Compression'], ['PARAFFIN', 'Paraffin'], ['GRASTON', 'Graston'], ['MET', 'MET'], ['PNF', 'PNF'], ['INFRARED', 'Infrared'], ['ESWT', 'ESWT'], ['US', 'US'], ['TENS', 'TENS'], ['EMS', 'EMS'], ['LASER', 'Laser'], ['CPM', 'CPM'], ['HOT_PACKS', 'Hot Packs'], ['COLD_PACKS', 'Cold Packs'], ['TRACTION', 'Traction'], ['EXERCISES', 'Exercises'], ['OTHER', 'Other']];

      // ── Title ─────────────────────────────────────────────────────────
      doc.rect(M, M, W, 30).fill(purple);
      doc.fillColor('white').font('Helvetica-Bold').fontSize(13).text('PHYSICAL THERAPY — FULL REPORT', M, M + 9, { width: W, align: 'center' });
      doc.fillColor(dark).font('Helvetica').fontSize(9).text(`Case No: ${c.caseNumber || ''}   |   Generated: ${new Date().toLocaleDateString('en-GB')}`, M, M + 36, { width: W, align: 'center' });
      doc.y = M + 52;

      // ── Register a new case / Patient ─────────────────────────────────
      banner('Register a New Case', 'تسجيل حالة جديدة');
      const p = c.patient;
      if (p) {
        row('Name', `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim());
        row('Patient No', p.patientNumber);
        row('ID Number', p.idNumber);
      }
      row('Case No', c.caseNumber);
      row('Status', c.status);
      row('Type of Medical Complaint', c.complaintType);
      row('Locating the Pain', c.painLocation);
      row('Duration of Complaint', c.complaintDuration);
      row('Notes', c.complaintNotes);
      yn('Chronic Diseases', c.hasChronicDiseases, c.chronicDiseasesDetail);
      yn('Visited a Specialist', c.visitedSpecialist, c.previousDoctorSeen);
      yn('Previous Physical Therapy', c.hadPreviousPT, c.previousTreatment);
      yn('Previous Surgery', c.hadSurgery, c.surgeryDetail);

      // ── Complaint ─────────────────────────────────────────────────────
      banner('Complaint', 'شكوى');
      row('Major Complaint / Symptoms', c.majorComplaint);
      row('Symptoms', c.symptoms);
      row('Current Job', c.currentJob);
      row('Start Date', c.complaintStartDate);
      row('Possible Cause', c.possibleCause);
      row('Time symptoms are best', c.bestTimeOfDay);
      row('Time pain is at its worst', c.worstTimeOfDay);
      checks('Current duration of pain', PAIN_DUR, c.painDuration);
      checks('Current level of pain', PAIN_LEVEL, c.painLevel);
      row('Is pain getting better or worse?', c.painProgression);
      row('Have you had this injury before?', c.hadPreviousInjury);

      // ── Mark Areas of Discomfort ──────────────────────────────────────
      banner('Mark Areas of Discomfort', 'حدد أماكن الألم');
      checks('Pain Types', PAIN_TYPES, c.painTypes);
      row('Pain Type (Other)', c.painTypeOther);
      checks('Aggravating Factors', FACTORS, c.aggravatingFactors);
      row('Aggravating (Other)', c.aggravatingOther);
      checks('Alleviating Factors', FACTORS, c.alleviatingFactors);
      row('Alleviating (Other)', c.alleviatingOther);
      if (c.painMap?.notes) row('Pain Location Notes', c.painMap.notes);

      // ── Medical History ───────────────────────────────────────────────
      const mh = c.medicalHistory;
      if (mh) {
        banner('Medical History', 'التاريخ الطبي');
        checks('Life Type', LIFE, c.lifeType);
        yn('Do you smoke?', mh.smokes, mh.smokingFrequency);
        yn('Have you ever smoked?', mh.hasSmokedBefore);
        yn('Pacemaker', mh.hasPacemaker, mh.pacemakerDetail);
        row('Allergies', mh.allergies);
        row('Current medications', mh.currentMedications);
        yn('Pregnant', mh.isPregnant);
        row('Previous diagnoses/medications', mh.previousDiagnoses);
        yn('Other health problems', mh.hasOtherHealthProblems, mh.otherConditions);
        row('Doctor restrictions', mh.doctorRestrictions);
        yn('Prescription/OTC drugs', mh.prescriptionDrugs, mh.currentMedications);
        yn('Herbal/Vitamins', mh.herbalSupplements, mh.supplementsList);
        yn('Allergic to adhesives/latex/bee stings', mh.adhesiveAllergy);
        row('Previous complaints/surgeries', mh.previousComplaintsSurgeries);
        yn('Had any surgeries', mh.hadSurgeries, mh.surgeriesDetail);
        if (Array.isArray(mh.surgeries) && mh.surgeries.length) {
          mh.surgeries.forEach((s: any, i: number) =>
            row(`Surgery ${i + 1}`, `${s.name ?? ''}${s.date ? ' — ' + fmtDate(s.date) : ''}${s.type ? ' (' + s.type + ')' : ''}`.trim()));
        }
        yn('PT for the same problem', mh.hadPTSameProblem, mh.ptSameProblemDetail);
        yn('Other treatments at this time', mh.receivingOtherTreatment, mh.otherTreatmentDetail);
        list('Tests done', mh.testsHad);
        row('Tests (Other)', mh.testsOther);
        row('Results', mh.testResults);
        row('New Analysis', mh.newAnalysis ? `${mh.newAnalysis}${mh.newAnalysisDate ? ' (' + fmtDate(mh.newAnalysisDate) + ')' : ''}` : '');
        row('Old Analysis', mh.oldAnalysis ? `${mh.oldAnalysis}${mh.oldAnalysisDate ? ' (' + fmtDate(mh.oldAnalysisDate) + ')' : ''}` : '');
        yn('Bone Density Test', mh.boneDensityTest, mh.boneDensityDetail);
        yn('Hospitalized in the past year', mh.hospitalizedLastYear, mh.hospitalizedDetail);
        list('Chronic conditions', mh.chronicConditions);
        row('Chronic conditions (Other)', mh.chronicConditionsOther);
      }

      // ── Goals of Treatment ────────────────────────────────────────────
      const g = c.treatmentGoals;
      if (g) {
        banner('Goals of Treatments', 'أهداف العلاجات');
        list('Goals', g.goals);
        row('Custom Goal', g.customGoal);
        yn('Decrease Pain', g.decreasePain);
        yn('Improve Strength', g.improveStrength);
        yn('Less difficulty with work activities', g.lessDifficultyWork);
        yn('Improve Movement', g.improveMovement);
        row('Stand longer (min)', g.standLongerMinutes);
        row('Sleep longer (min)', g.sleepLongerMinutes);
        row('Sit longer (min)', g.sitLongerMinutes);
        row('Anything else', g.otherGoals);
      }

      // ── Plan of Assessment / Postural ─────────────────────────────────
      const pa = c.posturalAssessment;
      if (pa) {
        banner('Plan of Assessment', 'خطة العلاج');
        row('Current seated position', pa.seatedPosition);
        row('Balance/Trunk Control', pa.trunkControl);
        row('Head', flattenRegion(pa.head));
        row('Shoulders', flattenRegion(pa.shoulders));
        row('Elbow', flattenRegion(pa.elbow));
        row('Rib cage', flattenRegion(pa.ribCage));
        row('Spine', flattenRegion(pa.spine));
        row('Pelvis', flattenRegion(pa.pelvis));
        row('Hips', flattenRegion(pa.hips));
        row('Knees', flattenRegion(pa.knees));
        row('Feet', flattenRegion(pa.feet));
        row('Spasticity/Reflexes/Tone', pa.spasticityNotes);
        row('Comments', pa.generalNotes);
        row('Diagnosis', pa.diagnosis);
      }

      // ── Plan of Treatment ─────────────────────────────────────────────
      const tp = c.treatmentPlan;
      if (tp) {
        banner('Plan of Treatment', 'خطة العلاج');
        row('From', fmtDate(c.treatmentFrom));
        row('To', fmtDate(c.treatmentTo));
        row('Anticipated No of Visits', c.anticipatedVisits);
        row('Physical Therapist', c.physiotherapistId);
        row('Case Manager', c.caseManagerId);
        row('Plan Status', tp.status);
        checks('Treatments', MODALITIES, tp.modalities);
        row('Other', tp.otherModality);
        row('Remarks', tp.remarks);
      }

      // ── Observation & Evaluation ──────────────────────────────────────
      const ev = c.evaluation;
      if (ev && (ev.modalities?.length || ev.notes || ev.evaluation || ev.otherModality)) {
        banner('Observation & Evaluation', 'الملاحظة والتقييم');
        checks('Treatments', MODALITIES, ev.modalities);
        row('Other', ev.otherModality);
        row('Notes', ev.notes);
        row('Evaluation', ev.evaluation);
      }

      // ── Therapeutic Procedures (Sessions) ─────────────────────────────
      const sessions = Array.isArray(c.sessions) ? c.sessions : [];
      banner(`Therapeutic Procedures — Sessions (${sessions.length})`, 'الجلسات العلاجية');
      if (sessions.length === 0) {
        doc.font('Helvetica').fillColor(gray).fontSize(9).text('  No sessions recorded.', M + 4, doc.y);
      } else {
        sessions.forEach((s: any) => {
          const time = s.sessionTime ? ` ${s.sessionTime}` : '';
          row(`Session ${s.sessionNumber ?? '-'}`, `${fmtDate(s.sessionDate)}${time}${s.notes ? '  —  ' + s.notes : ''}`);
          if (s.supervisorOpinion) row('    Supervisor Gaze', s.supervisorOpinion);
          if (s.doctorDecision) row('    Doctor Gaze', s.doctorDecision);
        });
      }

      // ── Final Summary ─────────────────────────────────────────────────
      banner('Summarizing', 'ملخص');
      text(c.finalSummary);

      // ── Footer ────────────────────────────────────────────────────────
      const ph = doc.page.height;
      doc.font('Helvetica').fontSize(8).fillColor(gray)
        .text('This document is confidential and intended for authorized personnel only.', M, ph - 35, { width: W, align: 'center' });

      doc.end();
    });
  }
}
