import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from, switchMap, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIDES = new Set(['LEFT', 'RIGHT', 'BILATERAL']);
// آخر جزء من المسار يحدد نوع العملية إن كان فعلاً
const VERB_ACTIONS: Record<string, string> = {
  sign: 'SIGN', 'director-sign': 'SIGN', 'patient-sign': 'SIGN', 'manager-sign': 'SIGN',
  archive: 'ARCHIVE', approve: 'APPROVE', respond: 'RESPOND', save: 'UPDATE',
};
const METHOD_ACTIONS: Record<string, string> = { POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' };
// قيم صغيرة مفيدة للعرض تُنسخ من جسم الطلب (الصنف والكمية…)
export const META_KEYS = ['partName', 'partCode', 'quantity', 'consumableName', 'role', 'decision'];
export const SENSITIVE = /password|token|secret|otp|signature|base64/i;
const IGNORED_DIFF_KEYS = new Set(['id', 'caseId', 'createdAt', 'updatedAt', 'limbSavedAt', 'romSavedAt']);
const MAX_VALUE_LEN = 1000;

export type Route = {
  caseId: string; parts: string[]; side?: string; subId?: string;
  type: string; action: string; isPdf: boolean;
};

/**
 * يحوّل مسار طلب على حالة أطراف إلى نوع حدث + عملية (مشترك بين الحارس وسكربت تعبئة الحالات القديمة).
 * يرجع null للمسارات التي لا تُسجَّل (بدون رقم حالة، أو تغيير المرحلة المسجّل بتاريخ المراحل).
 */
export function parseCaseRoute(method: string, path: string, isPdf: boolean): Route | null {
  const rest = String(path).split('/prosthetics/cases')[1]?.split('/').filter(Boolean) ?? [];
  if (rest.length === 0) {
    // إنشاء حالة — رقمها يُعرف من الرد
    return method === 'POST'
      ? { caseId: '', parts: [], type: 'CASE_CREATED', action: 'CREATE', isPdf: false }
      : null;
  }
  const caseId = rest[0];
  if (!UUID_RE.test(caseId)) return null;          // مسارات بدون رقم حالة (internal / sessions/...)
  const segs = rest.slice(1);
  if (segs[0] === 'status') return null;            // تغيير المرحلة مسجّل بتاريخ المراحل

  const route: Route = { caseId, parts: [], type: '', action: '', isPdf };
  for (const s of segs) {
    if (UUID_RE.test(s)) route.subId = s;
    else if (SIDES.has(s.toUpperCase())) route.side = s.toUpperCase();
    else route.parts.push(s);
  }
  const last = route.parts[route.parts.length - 1];
  if (isPdf) {
    route.type = 'CASE_PDF'; route.action = 'EXPORT';
  } else if (route.parts.length === 0) {
    route.type = 'CASE_UPDATED'; route.action = METHOD_ACTIONS[method] ?? method;
  } else {
    route.type = route.parts.join('_').replace(/-/g, '_').toUpperCase();
    route.action = VERB_ACTIONS[last] ?? METHOD_ACTIONS[method] ?? method;
  }
  return route;
}

/**
 * يسجّل حدثاً بجدول case_events بعد نجاح أي عملية كتابة على حالة أطراف (وتصدير PDF).
 * عند التعديل يقرأ السجل قبل وبعد (قراءة فقط) ويحفظ الحقول التي تغيّرت (القيمة القديمة ← الجديدة).
 * لا يغيّر الطلب ولا الرد، وأي فشل هنا لا يؤثر على العملية.
 */
@Injectable()
export class CaseEventsInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const isPdf = req.method === 'GET' && /\/prosthetics\/cases\/[^/]+\/pdf$/.test(req.path);
    if (req.method === 'GET' && !isPdf) return next.handle();

    let route: Route | null = null;
    let loader: (() => Promise<any>) | null = null;
    try {
      route = parseCaseRoute(req.method, req.path, isPdf);
      loader = route ? this.snapshotLoader(req.method, route) : null;
    } catch { /* التسجيل لا يوقف الطلب أبداً */ }

    // لقطة "قبل" للتعديلات فقط — فشلها يعني تسجيل الحدث بدون changes
    const before$ = loader ? Promise.resolve().then(loader).catch(() => null) : Promise.resolve(null);

    return from(before$).pipe(
      switchMap((before) => next.handle().pipe(
        tap({ next: (result) => { this.record(req, result, route, loader, before).catch(() => {}); } }),
      )),
    );
  }

  // يحدد السجل الذي يعدّله كل مسار تعديل — قراءة فقط
  private snapshotLoader(method: string, r: Route): (() => Promise<any>) | null {
    if (method !== 'PUT' && method !== 'PATCH') return null;
    const p = this.prisma as any;
    const { caseId, side, subId } = r;
    switch (r.parts.join('/')) {
      case '':                               return () => p.prostheticsCase.findUnique({ where: { id: caseId } });
      case 'assessment-upper':               return side ? () => p.upperLimbAssessment.findFirst({ where: { caseId, side }, orderBy: { examinedAt: 'desc' } }) : null;
      case 'assessment-lower':               return side ? () => p.lowerLimbAssessment.findFirst({ where: { caseId, side }, orderBy: { examinedAt: 'desc' } }) : null;
      case 'committee/decide':
      case 'committee/assign':               return () => p.committeeReview.findUnique({ where: { caseId } });
      case 'gait-analysis':                  return () => p.gaitAnalysis.findUnique({ where: { caseId } });
      case 'final-evaluation':               return () => p.finalEvaluation.findUnique({ where: { caseId } });
      case 'final-delivery':                 return () => p.finalDeliveryForm.findUnique({ where: { caseId } });
      case 'treatment-programs':             return subId ? () => p.caseTreatmentProgram.findFirst({ where: { id: subId, caseId } }) : null;
      case 'balance-assessment':             return subId ? () => p.balanceAssessmentForm.findFirst({ where: { id: subId, caseId } }) : null;
      case 'gait-analysis-forms':            return subId ? () => p.gaitAnalysisForm.findFirst({ where: { id: subId, caseId } }) : null;
      case 'review-program':                 return subId ? () => p.patientReviewProgram.findFirst({ where: { id: subId, caseId } }) : null;
      case 'prosthetic-delivery/items':
      case 'prosthetic-delivery/items/approve': return subId ? () => p.prostheticDeliveryItem.findUnique({ where: { id: subId } }) : null;
      default:                               return null;
    }
  }

  private async record(req: any, result: any, route: Route | null, loader: (() => Promise<any>) | null, before: any) {
    if (!route) return;
    const caseId = route.caseId || result?.id;
    if (!caseId || !UUID_RE.test(caseId)) return;

    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const fields = Object.keys(body).filter((k) => !SENSITIVE.test(k));

    const metadata: Record<string, any> = {};
    if (route.side) metadata.side = route.side;
    if (route.subId) metadata.subId = route.subId;
    for (const k of META_KEYS) {
      const v = body[k];
      if (v !== undefined && (typeof v !== 'string' || v.length <= 200)) metadata[k] = v;
    }
    if (Array.isArray(req.body)) metadata.count = req.body.length;
    if (Array.isArray(body.items)) metadata.count = body.items.length;

    // القيمة القديمة ← الجديدة (للتعديلات فقط)
    if (loader && before) {
      const after = await Promise.resolve().then(loader).catch(() => null);
      if (after) {
        const changes = this.diff(before, after, fields);
        if (changes.length) metadata.changes = changes;
      }
    }

    const c = await this.prisma.prostheticsCase.findUnique({ where: { id: caseId }, select: { status: true } });
    if (!c) return;

    await this.prisma.caseEvent.create({
      data: {
        caseId, type: route.type, action: route.action,
        stage: c.status as string,
        actorId: req.user?.userId ?? null,
        method: req.method,
        path: req.path,
        fields,
        metadata: Object.keys(metadata).length ? metadata : undefined,
      },
    });
  }

  // الحقول المرسلة (أو كل الحقول إن لم يُرسل شيء) التي تغيّرت فعلاً بين قبل وبعد
  private diff(before: Record<string, any>, after: Record<string, any>, fields: string[]) {
    const keys = (fields.length ? fields : Object.keys(after))
      .filter((k) => k in after && !IGNORED_DIFF_KEYS.has(k) && !SENSITIVE.test(k));
    const out: Array<{ field: string; oldValue: any; newValue: any }> = [];
    for (const k of keys) {
      const o = this.normalize(before[k]);
      const n = this.normalize(after[k]);
      if (JSON.stringify(o) !== JSON.stringify(n)) out.push({ field: k, oldValue: o, newValue: n });
    }
    return out;
  }

  private normalize(v: any): any {
    if (v === undefined) return null;
    if (v instanceof Date) return v.toISOString();
    const s = JSON.stringify(v);
    if (s && s.length > MAX_VALUE_LEN) return { truncated: true, length: s.length };
    return v;
  }
}
