/**
 * تعبئة أحداث الحالات القديمة (المرحلة د) — يُشغَّل مرة واحدة يدوياً.
 *
 * يقرأ سجل العمليات public.audit_logs (قراءة فقط) ويضيف أحداثاً بجدول case_events فقط،
 * لكل ما حصل قبل بدء التسجيل التلقائي. لا يعدّل ولا يحذف أي جدول أو سجل آخر.
 * - بدون --apply: يطبع ما سيُضاف فقط (تجربة جافة).
 * - مع --apply: يضيف. آمن لإعادة التشغيل (لا يكرر سجلاً سبق إضافته).
 *
 * التشغيل داخل الحاوية:
 *   node dist/apps/clinical-prosthetics/src/scripts/backfill-case-events.js           (تجربة)
 *   node dist/apps/clinical-prosthetics/src/scripts/backfill-case-events.js --apply   (تنفيذ)
 */
import { PrismaClient } from '@prisma/client';
import { parseCaseRoute, META_KEYS, SENSITIVE, UUID_RE } from '../common/interceptors/case-events.interceptor';

const STATUS_PATH_RE = /\/prosthetics\/cases\/([0-9a-f-]{36})\/status$/i;

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  try {
    // ما بعد أول حدث مسجّل تلقائياً مغطّى أصلاً — نعبّئ ما قبله فقط
    const firstLive = await prisma.caseEvent.findFirst({
      where: { NOT: { metadata: { path: ['backfilled'], equals: true } } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    const cutoff = firstLive?.createdAt ?? new Date();

    const audits = await prisma.$queryRawUnsafe<Array<{
      id: bigint; userId: string | null; method: string; path: string; metadata: any; createdAt: Date;
    }>>(
      `SELECT id, "userId", method, path, metadata, "createdAt"
       FROM public.audit_logs
       WHERE method IN ('POST','PUT','PATCH','DELETE')
         AND path LIKE '/api/v1/prosthetics/cases%'
         AND "createdAt" < $1
       ORDER BY "createdAt"`,
      cutoff,
    );

    const cases = await prisma.prostheticsCase.findMany({ select: { id: true, createdAt: true, createdBy: true } });
    const caseById = new Map(cases.map((c) => [c.id, c]));

    // ما سبقت إضافته (لإعادة التشغيل بأمان)
    const done = await prisma.caseEvent.findMany({
      where: { metadata: { path: ['backfilled'], equals: true } },
      select: { caseId: true, type: true, metadata: true },
    });
    const doneAuditIds = new Set(done.map((d: any) => d.metadata?.auditLogId).filter(Boolean));
    const hasCreated = new Set(
      (await prisma.caseEvent.findMany({ where: { type: 'CASE_CREATED' }, select: { caseId: true } })).map((e) => e.caseId),
    );

    const rows: any[] = [];
    let skipped = 0;
    for (const a of audits) {
      const auditLogId = String(a.id);
      if (doneAuditIds.has(auditLogId)) continue;
      const meta = a.metadata && typeof a.metadata === 'object' ? a.metadata : {};

      let caseId: string | undefined;
      let type: string;
      let action: string;
      const metadata: Record<string, any> = { backfilled: true, auditLogId };

      const statusMatch = a.method === 'PUT' ? STATUS_PATH_RE.exec(a.path) : null;
      if (statusMatch) {
        caseId = statusMatch[1];
        type = 'STATUS_CHANGED';
        action = 'STATUS_CHANGE';
        if (meta.status) metadata.toStatus = meta.status;
      } else {
        const route = parseCaseRoute(a.method, a.path, false);
        if (!route) { skipped++; continue; }
        type = route.type;
        action = route.action;
        if (route.side) metadata.side = route.side;
        if (route.subId) metadata.subId = route.subId;
        if (route.caseId) caseId = route.caseId;
        else {
          // إنشاء حالة — نطابقها بمن أنشأها ووقت الإنشاء (±5 ثوانٍ)
          const t = a.createdAt.getTime();
          caseId = cases.find((c) => c.createdBy === a.userId && Math.abs(c.createdAt.getTime() - t) < 5000)?.id;
        }
      }
      if (!caseId || !UUID_RE.test(caseId) || !caseById.has(caseId)) { skipped++; continue; }

      for (const k of META_KEYS) if (meta[k] !== undefined) metadata[k] = meta[k];
      if (type === 'CASE_CREATED') hasCreated.add(caseId);

      rows.push({
        caseId, type, action, stage: null,
        actorId: a.userId ?? null,
        method: a.method, path: a.path,
        fields: Object.keys(meta).filter((k) => !SENSITIVE.test(k)),
        metadata,
        createdAt: a.createdAt,
      });
    }

    // حالات أُنشئت قبل وجود سجل العمليات — حدث إنشاء من تاريخ الحالة نفسها
    for (const c of cases) {
      if (hasCreated.has(c.id) || c.createdAt >= cutoff) continue;
      rows.push({
        caseId: c.id, type: 'CASE_CREATED', action: 'CREATE', stage: null,
        actorId: c.createdBy ?? null, method: 'POST', path: '/api/v1/prosthetics/cases',
        fields: [], metadata: { backfilled: true, source: 'case.createdAt' },
        createdAt: c.createdAt,
      });
    }

    const byType: Record<string, number> = {};
    for (const r of rows) byType[r.type] = (byType[r.type] ?? 0) + 1;
    console.log(`cutoff (بداية التسجيل التلقائي): ${cutoff.toISOString()}`);
    console.log(`audit rows read: ${audits.length}, skipped (no case / not tracked): ${skipped}`);
    console.log(`cases: ${cases.length}, events to add: ${rows.length}`);
    for (const [t, n] of Object.entries(byType).sort()) console.log(`  ${t.padEnd(40)} ${n}`);

    if (!apply) {
      console.log('\nتجربة فقط — لم يُضف شيء. أعيدي التشغيل مع --apply للتنفيذ.');
      return;
    }

    let inserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const res = await prisma.caseEvent.createMany({ data: rows.slice(i, i + 500) });
      inserted += res.count;
    }
    console.log(`\n✅ أُضيف ${inserted} حدث إلى case_events`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error('❌', e?.message ?? e); process.exit(1); });
