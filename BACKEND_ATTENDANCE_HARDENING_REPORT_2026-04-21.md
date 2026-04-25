# تقرير تحسين نظام الحضور والبصمة

تاريخ التقرير: 2026-04-21
الجمهور المستهدف: مبرمج الباك اند
الهدف: رفع دقة الحضور والغياب والتأخير والبريك والأوفرتايم إلى مستوى إطلاق إنتاجي مع شرط صارم بعدم فقدان بيانات الموظفين.

---

## 1) ملخص تنفيذي

الوضع الحالي يعمل وظيفيا، لكنه غير كاف للاعتماد النهائي في الرواتب بدون تحسينات حرجة.

أهم المشاكل المؤثرة على الدقة:
- مسار البصمة يكتب مباشرة في attendance وقد يثبت الحالة PRESENT بشكل دائم.
- مسار البصمة لا يحسب overtimeMinutes حاليا.
- إعادة مزامنة البصمات تقوم بحذف بريكات اليوم ثم إعادة إدخالها، وهذا قد يضيع حقولا مضافة يدويا مثل reason و isAuthorized.
- الورديات الليلية معرضة لانقسام سجل الوردية على يومين إذا لم يتم توحيد تاريخ الوردية المرجعي.
- بعض التقارير تستخدم breakMinutes القديم بدل totalBreakMinutes.
- الاعتماد على status فقط في بعض التقارير يؤدي لإخفاء تأخيرات موجودة في lateMinutes.
- اعتماد الإجازة قد يكتب ON_LEAVE فوق سجل حضور فعلي لنفس اليوم.

النتيجة المطلوبة:
- محرك احتساب موحد لكل المسارات.
- إغلاق يومي للغياب و missing clock-out.
- backfill آمن بدون حذف أو تعديل تدميري.
- تقارير متسقة 100% مع بيانات attendance_records.

---

## 2) مبدأ عدم فقدان البيانات (Non-Negotiable)

أي تعديل يجب يلتزم بالقواعد التالية:
- ممنوع حذف بيانات تشغيلية حالية في attendance_records أو attendance_breaks أو raw_attendance_logs.
- أي تغيير بنيوي يكون Additive فقط (إضافة أعمدة/جداول، بدون Drop).
- قبل التنفيذ: Backup كامل + اختبار استرجاع فعلي.
- قبل backfill: إنشاء Snapshot tables للرجوع والمقارنة.
- أي تحديث جماعي يتم على دفعات صغيرة داخل Transactions مع Logs.
- الاحتفاظ بسجل تدقيق لكل تعديل آلي على attendance_records.

---

## 3) الثغرات الحالية مع مواقعها

1. كتابة مباشرة من zkteco إلى attendance
- ملف: apps/zkteco/src/sync/sync.service.ts
- سلوك: INSERT/UPDATE مباشر على attendance.attendance_records.
- أثر: تجاوز جزء من منطق AttendanceRecordsService.

2. تثبيت الحالة PRESENT في مسار zkteco
- ملف: apps/zkteco/src/sync/sync.service.ts
- سلوك: إدخال status = PRESENT عند إنشاء السجل.
- أثر: قد لا يظهر التأخير/الخروج المبكر كحالة.

3. لا يوجد حساب overtime في zkteco sync
- ملف: apps/zkteco/src/sync/sync.service.ts
- أثر: overtime ناقص للموظفين المعتمدين على البصمة.

4. حذف كامل للبريكات في كل مزامنة
- ملف: apps/zkteco/src/sync/sync.service.ts
- سلوك: DELETE من attendance_breaks ثم INSERT جديد.
- أثر: فقدان reason/isAuthorized والتعديلات اليدوية على البريك.

5. مخاطر الورديات الليلية
- ملف: apps/zkteco/src/sync/sync.service.ts + apps/zkteco/src/common/utils/timezone.ts
- سلوك: dateStr مشتق من timestamp مباشرة.
- أثر: احتمال انقسام نفس الوردية الليلية على يومين.

6. عدم اتساق تقارير البريك
- ملف: apps/attendance/src/reports/reports.service.ts
- سلوك: breaksReport يستخدم breakMinutes القديم في أجزاء منه.
- أثر: تقرير غير دقيق مقارنة بباقي التقارير.

7. اعتماد تقرير التأخير على status فقط
- ملف: apps/attendance/src/reports/reports.service.ts
- سلوك: latenessReport يعتمد status = LATE.
- أثر: lateMinutes قد تكون موجودة لكن غير ظاهرة.

8. تضارب إجازة مع حضور فعلي
- ملف: apps/leave/src/leave-requests/leave-requests.service.ts
- سلوك: ON CONFLICT يكتب status = ON_LEAVE.
- أثر: إمكانية الكتابة فوق يوم فيه حضور فعلي.

---

## 4) التصميم المستهدف (Target Design)

### 4.1 محرك احتساب موحد
إنشاء AttendanceComputationService موحد، ويستدعى من:
- مسار zkteco sync.
- مسار attendance check-in/check-out/device endpoints.
- أي backfill لاحق.

هذا المحرك يجب أن يحسب:
- workedMinutes
- totalBreakMinutes
- netWorkedMinutes
- lateMinutes
- earlyLeaveMinutes
- overtimeMinutes
- status النهائي
- flags إضافية (isLate, isEarlyLeave) إذا لزم

### 4.2 قاعدة الحالة النهائية
لمنع التضارب، اعتمد ترتيب أولوية واضح:
- ON_LEAVE
- HOLIDAY
- WEEKEND
- ABSENT
- LATE (إذا lateMinutes > 0)
- EARLY_LEAVE (إذا earlyLeaveMinutes > 0)
- PRESENT

ملاحظة:
إذا تأخير + خروج مبكر بنفس اليوم، لا نخسر أي معلومة:
- status حسب أولوية متفق عليها.
- lateMinutes و earlyLeaveMinutes يبقوا محفوظين دائما.

### 4.3 تاريخ الوردية المرجعي
لا تعتمد date = تاريخ البصمة دائما.
اعتمد shift anchor date الناتج من نافذة الوردية الفعلية (Day/Night) لتجنب انقسام الوردية الليلية.

### 4.4 سياسة الإجازة عند التعارض
عند إنشاء ON_LEAVE:
- لا تكتب فوق يوم فيه clockInTime أو clockOutTime موجودين.
- سجّل conflict alert للمتابعة اليدوية بدل overwrite.

---

## 5) التعديلات المطلوبة حسب الملفات

### A) apps/zkteco/src/sync/sync.service.ts

مطلوب:
1. استبدال التاريخ المستخدم في upsert بتاريخ الوردية المرجعي وليس تاريخ timestamp الخام.
2. حساب overtimeMinutes ضمن نفس مسار الحساب.
3. تحديث status بناء على late/early وعدم تركه PRESENT دائما.
4. تعبئة source = BIOMETRIC و deviceSN عند الإنشاء/التحديث.
5. إلغاء نمط DELETE ثم INSERT للبريكات، واستبداله بـ merge/upsert يحافظ على reason/isAuthorized.
6. عند اكتشاف conflict أو تناقض rawType، سجله في syncError بدون حذف بيانات سابقة.

### B) apps/attendance/src/attendance-records/attendance-records.service.ts

مطلوب:
1. استخراج منطق الاحتساب إلى خدمة مشتركة وإعادة استخدامه هنا.
2. الإبقاء على checkOut كمسار مرجعي متوافق مع المحرك الجديد.
3. توحيد قواعد status و overtime مع zkteco.

### C) apps/attendance/src/reports/reports.service.ts

مطلوب:
1. breaksReport يعتمد totalBreakMinutes فقط.
2. latenessReport يعتمد lateMinutes > 0 (مع status كشرط مساعد فقط وليس حصري).
3. توحيد حساب breakOverLimit مع نفس دالة/خدمة الاحتساب المستخدمة في payroll.

### D) apps/leave/src/leave-requests/leave-requests.service.ts

مطلوب:
1. تعديل ON CONFLICT لعدم overwrite أيام حضور فعلي.
2. إذا وجد تعارض، إنشاء alert من نوع LEAVE_ATTENDANCE_CONFLICT.

### E) apps/attendance/prisma/schema.prisma

مطلوب Additive فقط (بدون حذف أعمدة):
1. إضافة أعمدة فنية للتتبع مثل:
- computationVersion
- shiftAnchorDate
- recomputedAt
2. إذا احتجت حالات مركبة، أضف flags بدون كسر status الحالي.
3. إضافة فهارس لازمة لتحسين backfill والتقارير.

---

## 6) خطة تنفيذ آمنة بدون فقدان بيانات

## المرحلة P0 (حرجة قبل الإطلاق)
المدة: 3-5 أيام

- توحيد الاحتساب في خدمة مشتركة.
- إصلاح zkteco لحساب overtime/status/source.
- إيقاف DELETE للبريكات واستبداله بمزامنة تحفظ البيانات اليدوية.
- إصلاح breaksReport و latenessReport.
- منع overwrite ON_LEAVE لأيام حضور فعلي.

خروج المرحلة:
- أرقام التقارير الأساسية متوافقة مع attendance_records.
- لا فقدان حقول reason/isAuthorized في أي إعادة مزامنة.

## المرحلة P1 (إغلاق تشغيلي يومي)
المدة: 4-7 أيام

- إضافة daily closure job:
  - توليد ABSENT للأيام العاملة بلا سجل حضور.
  - توليد MISSING_CLOCK_OUT للحضور المفتوح بعد cutoff.
- إضافة reconciler يتحقق من أي فرق بين raw logs و attendance.

خروج المرحلة:
- الغياب يظهر يوميا دون انتظار payroll.
- تناقضات البصمات تنكشف مبكرا عبر alerts.

## المرحلة P2 (Hardening + Backfill)
المدة: 3-5 أيام

- Backfill تاريخي آمن (3-6 أشهر) على دفعات.
- مقارنة قبل/بعد للتأكد من عدم كسر الرواتب.
- مراقبة إنتاجية: syncError rate, unsynced logs, report deltas.

---

## 7) خطة Backfill بدون خسارة

1. إنشاء snapshot:
- attendance.attendance_records_snapshot_20260421
- attendance.attendance_breaks_snapshot_20260421

2. تشغيل backfill في وضع Dry-Run:
- حساب النتائج الجديدة في جداول staging فقط.
- مقارنة مفصلة مع الإنتاج قبل أي update.

3. تطبيق update على دفعات:
- حسب employeeId + month.
- transaction لكل دفعة.
- log لكل record تغير.

4. قواعد حماية أثناء backfill:
- ممنوع DELETE.
- ممنوع تعديل clockInTime/clockOutTime الخام إلا إذا ثبت خطأ parsing.
- تحديث الحقول المحسوبة فقط.

---

## 8) سيناريوهات QA الإلزامية

1. دخول وخروج طبيعي.
2. دخول + بريك + رجوع + خروج.
3. بريك مفتوح حتى نهاية اليوم.
4. تأخير فقط.
5. خروج مبكر فقط.
6. تأخير + خروج مبكر في نفس اليوم.
7. أوفرتايم مع allowOvertime = true.
8. أوفرتايم مع allowOvertime = false.
9. وردية ليلية تعبر منتصف الليل.
10. بصمات مكررة أقل من دقيقتين.
11. PIN غير مربوط.
12. موظف inactive.
13. إجازة معتمدة في يوم عمل بدون حضور.
14. إجازة معتمدة تتعارض مع حضور فعلي.
15. إعادة مزامنة logs لنفس اليوم (Idempotency).

معيار النجاح لكل سيناريو:
- attendance_record صحيح.
- breaks صحيحة بدون فقدان reason/isAuthorized.
- alerts صحيحة.
- التقارير الشهرية واليومية متطابقة مع البيانات الأساسية.

---

## 9) مؤشرات القبول قبل الإطلاق

- دقة مطابقة الحضور الفعلي >= 99.5%
- syncError rate < 0.5%
- unsynced raw logs = 0 (أو ضمن حد معروف ومبرر)
- فروقات التقارير الحرجة = 0
- عدم وجود فقدان بيانات مثبت بمقارنة snapshot
- نجاح اختبار rollback من backup

---

## 10) Runbook نشر آمن

1. قبل النشر
- Backup كامل + اختبار restore.
- تفعيل feature flags للتشغيل التدريجي.
- تجهيز dashboards للمراقبة.

2. أثناء النشر
- نشر migration additive فقط.
- نشر الكود مع تعطيل backfill التلقائي.
- تفعيل مسار الحساب الجديد على عينة صغيرة من الموظفين.

3. بعد النشر
- مراقبة 24-48 ساعة.
- تفعيل backfill على دفعات.
- مراجعة تقارير HR/Payroll اليومية.

4. خطة التراجع
- إيقاف feature flag.
- استرجاع من backup إذا لزم.
- إعادة تشغيل المسار القديم مؤقتا مع تجميد updates الخطرة.

---

## 11) Checklist تسليم للمبرمج

- [ ] تنفيذ AttendanceComputationService موحد
- [ ] إدخال overtime/status/source في zkteco sync
- [ ] إزالة DELETE من مزامنة البريكات
- [ ] إصلاح breaksReport على totalBreakMinutes
- [ ] إصلاح latenessReport ليعتمد lateMinutes
- [ ] حماية ON_LEAVE من overwrite حضور فعلي
- [ ] إضافة daily closure job للغياب وmissing clock-out
- [ ] إضافة audit trail للتعديلات الآلية
- [ ] إعداد snapshot + dry-run + backfill script
- [ ] تنفيذ UAT الكامل قبل go-live

---

## 12) ملاحظة ختامية

هذا التقرير يركز على عدم فقدان البيانات كأولوية أعلى من السرعة.
أي خطوة غير قابلة للرجوع يجب ألا تُنفذ قبل وجود backup مجرب + snapshot + خطة rollback واضحة.
