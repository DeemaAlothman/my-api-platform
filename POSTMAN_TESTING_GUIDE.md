# Evaluation API - Postman Testing Guide

## الملفات المطلوبة
1. `Evaluation_API_Tests.postman_collection.json` - مجموعة الاختبارات
2. `Evaluation_API_Environment.postman_environment.json` - متغيرات البيئة

## خطوات الاستيراد

### 1. استيراد Collection
1. افتح Postman
2. اضغط على **Import** (أعلى اليسار)
3. اسحب ملف `Evaluation_API_Tests.postman_collection.json`
4. اضغط **Import**

### 2. استيراد Environment
1. اضغط على **Import** مرة أخرى
2. اسحب ملف `Evaluation_API_Environment.postman_environment.json`
3. اضغط **Import**
4. اختر Environment من القائمة المنسدلة أعلى اليمين

## ترتيب الاختبار

### المرحلة 1: التسجيل والإعداد
```
0. Auth > Login
   ↓
   (سيتم حفظ الـ token تلقائياً)
```

### المرحلة 2: إنشاء فترة التقييم
```
1. Evaluation Periods > Create Period
   ↓
   (سيتم حفظ period_id تلقائياً)
   ↓
1. Evaluation Periods > Open Period
```

### المرحلة 3: إنشاء المعايير (اختياري)
```
2. Evaluation Criteria > Get All Criteria
   ↓
   (إذا كانت فارغة، أنشئ معايير)
   ↓
2. Evaluation Criteria > Create Criteria
```

### المرحلة 4: إنشاء نماذج التقييم
```
طريقة 1: إنشاء نموذج واحد
3. Evaluation Forms > Create Form

طريقة 2: إنشاء نماذج لعدة موظفين
1. Evaluation Periods > Generate Forms
```

### المرحلة 5: عملية التقييم
```
3. Evaluation Forms > Get My Form
   ↓
3. Evaluation Forms > Save Self Evaluation
   ↓
3. Evaluation Forms > Submit Self Evaluation
   ↓
3. Evaluation Forms > Save Manager Evaluation
   ↓
3. Evaluation Forms > Submit Manager Evaluation
   ↓
3. Evaluation Forms > HR Review
   ↓
3. Evaluation Forms > GM Approval
```

## الصلاحيات المطلوبة

### Evaluation Forms
| Endpoint | Permission |
|----------|-----------|
| GET /evaluation-forms | `evaluation:forms:view-all` |
| GET /evaluation-forms/my | `evaluation:forms:view-own` |
| PATCH /evaluation-forms/:id/self | `evaluation:forms:self-evaluate` |
| PATCH /evaluation-forms/:id/manager | `evaluation:forms:manager-evaluate` |
| POST /evaluation-forms/:id/hr-review | `evaluation:forms:hr-review` |
| POST /evaluation-forms/:id/gm-approval | `evaluation:forms:gm-approval` |

### Evaluation Periods
| Endpoint | Permission |
|----------|-----------|
| GET /evaluation-periods | `evaluation:periods:read` |
| POST /evaluation-periods | `evaluation:periods:create` |
| PATCH /evaluation-periods/:id | `evaluation:periods:update` |
| DELETE /evaluation-periods/:id | `evaluation:periods:delete` |
| POST /evaluation-periods/:id/open | `evaluation:periods:manage` |
| POST /evaluation-periods/:id/close | `evaluation:periods:manage` |
| POST /evaluation-periods/:id/generate-forms | `evaluation:periods:manage` |

### Evaluation Criteria
| Endpoint | Permission |
|----------|-----------|
| GET /evaluation-criteria | `evaluation:criteria:read` |
| POST /evaluation-criteria | `evaluation:criteria:create` |
| PATCH /evaluation-criteria/:id | `evaluation:criteria:update` |
| DELETE /evaluation-criteria/:id | `evaluation:criteria:delete` |

### Employee Goals
| Endpoint | Permission |
|----------|-----------|
| جميع endpoints الخاصة بالأهداف | `evaluation:goals:manage` |

### Peer Evaluations
| Endpoint | Permission |
|----------|-----------|
| POST /peer-evaluations/forms/:formId/peer | `evaluation:peer:submit` |

## المتغيرات (Variables)

يتم حفظ هذه المتغيرات تلقائياً بعد كل طلب:
- `token` - يتم حفظه بعد Login
- `period_id` - يتم حفظه بعد Create Period
- `form_id` - يتم حفظه بعد Create Form
- `criteria_id` - يتم حفظه بعد Create Criteria

يمكنك تعديل:
- `employee_id` - معرف الموظف (افتراضياً: emp-admin-001)
- `base_url` - عنوان API (افتراضياً: http://217.76.53.136:8000/api/v1)

## أمثلة على Bodies

### إنشاء فترة تقييم
```json
{
  "code": "Q1-2026",
  "nameAr": "تقييم الربع الأول 2026",
  "nameEn": "Q1 2026 Evaluation",
  "startDate": "2026-01-01",
  "endDate": "2026-03-31"
}
```

### إنشاء معيار
```json
{
  "code": "PERF_001",
  "nameAr": "جودة العمل",
  "nameEn": "Work Quality",
  "descriptionAr": "مستوى الدقة والإتقان",
  "weight": 1.5,
  "maxScore": 5,
  "category": "PERFORMANCE",
  "displayOrder": 1
}
```

### التقييم الذاتي
```json
{
  "sections": [
    {
      "criteriaId": "{{criteria_id}}",
      "score": 4,
      "comments": "أداء جيد"
    }
  ],
  "comments": "تقييم ذاتي شامل"
}
```

### تقييم المدير
```json
{
  "sections": [
    {
      "criteriaId": "{{criteria_id}}",
      "score": 4,
      "comments": "أداء ممتاز"
    }
  ],
  "comments": "تقييم عام",
  "strengths": "مهارات فنية قوية",
  "weaknesses": "يحتاج تحسين في إدارة الوقت",
  "recommendations": "تدريب موصى به"
}
```

### مراجعة HR
```json
{
  "comments": "تمت المراجعة",
  "recommendation": "PROMOTION"
}
```

**HR Recommendations:**
- `PROMOTION` - ترقية
- `SALARY_INCREASE` - زيادة راتب
- `BONUS` - مكافأة
- `TRAINING` - تدريب
- `WARNING` - إنذار
- `TERMINATION` - إنهاء خدمة
- `NO_ACTION` - لا إجراء

### موافقة GM
```json
{
  "status": "APPROVED",
  "comments": "تمت الموافقة"
}
```

**GM Status:**
- `APPROVED` - موافق
- `REJECTED` - مرفوض
- `NEEDS_REVISION` - يحتاج مراجعة

## ملاحظات مهمة

1. **ابدأ دائماً بـ Login** للحصول على الـ token
2. **التسلسل مهم**: أنشئ Period قبل Forms، وأنشئ Criteria قبل التقييم
3. **المتغيرات تُحفظ تلقائياً** من الـ responses
4. **تحقق من الـ Environment** قبل بدء الاختبار
5. **Self Evaluation** يجب أن يكون من الموظف نفسه
6. **Manager Evaluation** يجب أن يكون من مدير الموظف

## استكشاف الأخطاء

### Error: Unauthorized (401)
- تأكد من تسجيل الدخول والحصول على token جديد

### Error: Forbidden (403)
- تحقق من الصلاحيات المطلوبة للـ endpoint
- تأكد من أن المستخدم له الصلاحية المناسبة

### Error: Not Found (404)
- تحقق من أن الـ IDs صحيحة في المتغيرات
- تأكد من إنشاء الموارد قبل استخدامها

### Error: Bad Request (400)
- تحقق من صحة البيانات المرسلة
- تأكد من وجود جميع الحقول المطلوبة

## روابط مفيدة

- **API Documentation**: http://217.76.53.136:8000/api/docs
- **Production URL**: http://217.76.53.136:8000
- **Evaluation Guide**: [EVALUATION_SERVICE_GUIDE.md](./EVALUATION_SERVICE_GUIDE.md)
