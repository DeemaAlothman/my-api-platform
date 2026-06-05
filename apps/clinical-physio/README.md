# Clinical Physio Service — عقد الـ API (مرجع الفرونت)

> مصدر الحقيقة لأسماء الحقول والـ enums هو هذا الباك. الفرونت يطابقه حرفياً.

## الحالات (PhysioStatus) وآلة الانتقال

```
INTAKE → COMPLAINT → PAIN_MAP → MEDICAL_HISTORY → GOALS →
POSTURAL_ASSESSMENT → TREATMENT_PLAN → SUPERVISOR_REVIEW →
DOCTOR_SIGN → ACTIVE_TREATMENT → COMPLETED → DISCHARGED
```
- أي حالة (عدا DISCHARGED/CANCELLED) → `CANCELLED`.
- `SUPERVISOR_REVIEW` → يمكن الرجوع لـ `TREATMENT_PLAN`.
- الانتقال إلى `ACTIVE_TREATMENT` ممنوع بدون `treatmentPlan.doctorSignatureBase64`.
- أي انتقال خارج الخريطة ⇒ `400 INVALID_TRANSITION { from, to, allowed }`.

## Endpoints

| Method | Path | Permission | الناتج |
|---|---|---|---|
| POST | `/physio/cases` | `clinic.physio.case.create` | INTAKE (يتحقق من وجود المريض) |
| GET | `/physio/cases` | `clinic.physio.case.view` | قائمة |
| GET | `/physio/cases/:id` | `clinic.physio.case.view` | حالة كاملة |
| GET | `/physio/cases/by-patient/:patientId` | `clinic.physio.case.view` | حالات مريض |
| PUT | `/physio/cases/:id` | `clinic.physio.case.create` | تحديث |
| PUT | `/physio/cases/:id/status` | `clinic.physio.case.create` | state-machine |
| POST/PUT | `/physio/cases/:id/pain-map` | `clinic.physio.assessment.create` | |
| POST | `/physio/cases/:id/medical-history` | `clinic.physio.assessment.create` | |
| POST | `/physio/cases/:id/medical-history/surgeries` | `clinic.physio.assessment.create` | |
| POST | `/physio/cases/:id/goals` | `clinic.physio.assessment.create` | |
| POST | `/physio/cases/:id/postural-assessment` | `clinic.physio.assessment.create` | |
| POST/PUT | `/physio/cases/:id/treatment-plan` | `clinic.physio.assessment.create` | |
| PUT | `/physio/cases/:id/treatment-plan/supervisor-review` | `clinic.physio.supervisor_review` | TREATMENT_PLAN→SUPERVISOR_REVIEW |
| POST | `/physio/cases/:id/treatment-plan/doctor-sign` | `clinic.physio.plan.sign` | يثبّت التوقيع، SUPERVISOR_REVIEW→DOCTOR_SIGN |
| POST | `/physio/cases/:id/sessions` | `clinic.physio.sessions.create` | يقبل `appointmentId` |
| GET | `/physio/cases/:id/sessions` | `clinic.physio.case.view` | |
| PUT/DELETE | `/physio/cases/:id/sessions/:sessionId` | `clinic.physio.sessions.create` | |
| GET | `/physio/cases/:id/timeline` | `clinic.physio.case.view` | |
| GET | `/physio/cases/:id/pdf` | `clinic.physio.case.view` | PDF |

### قواعد التوقيع (doctor-sign)
- `409 ALREADY_SIGNED` إن كان موقّعاً مسبقاً (لا استبدال).
- `403 NOT_ASSIGNED_SIGNER` إن لم يكن الموقّع هو `supervisingDoctorId` المعيّن.
- يُخزَّن `doctorSignedAt` + `doctorSignatureIp` ولا يُعدَّلان لاحقاً.

## Enums المعتمدة
انظر القسم 3 من `PHYSIO_BACKEND_TASKS.md` — كلها مطبّقة في `dto/physio-case.dto.ts` و `prisma/schema.prisma`.
`MedicalTest` يتضمن `BONE_DENSITY`. الحقل الجديد للمريض: `occupation`.

## نقطة داخلية (خدمة-لخدمة فقط — محظورة عبر الـ gateway)
`GET /patients/internal/:id/exists` — محمية بـ `InternalAuthGuard`.
