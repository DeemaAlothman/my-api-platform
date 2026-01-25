# 📊 دليل Evaluation Service الكامل

## نظرة عامة

خدمة التقييم (Evaluation Service) هي خدمة microservice مستقلة تدير عملية تقييم الأداء الكاملة للموظفين.

- **البورت**: 4005
- **Schema**: evaluation
- **Gateway Prefix**: `/api/v1/evaluation-*`

---

## 🗄️ قاعدة البيانات

### الجداول (7 Tables):

1. **EvaluationPeriod** - دورات التقييم (سنوية/نصف سنوية)
2. **EvaluationCriteria** - معايير التقييم (12 معيار افتراضي)
3. **EvaluationForm** - نماذج التقييم (لكل موظف)
4. **EvaluationSection** - أقسام التقييم (تقييم لكل معيار)
5. **PeerEvaluation** - تقييمات الأقران
6. **EmployeeGoal** - أهداف الموظف
7. **EvaluationHistory** - سجل التغييرات (Audit)

### الأنواع (9 Enums):

- **PeriodStatus**: DRAFT, OPEN, CLOSED
- **CriteriaCategory**: PERFORMANCE, BEHAVIOR, SKILLS, ACHIEVEMENT, DEVELOPMENT
- **FormStatus**: NOT_STARTED, IN_PROGRESS, SUBMITTED
- **EvaluationStatus**: 8 حالات من PENDING_SELF إلى COMPLETED
- **HRRecommendation**: PROMOTION, SALARY_INCREASE, BONUS, TRAINING, WARNING, TERMINATION, NO_ACTION
- **ApprovalStatus**: APPROVED, REJECTED, NEEDS_REVISION
- **FinalRating**: EXCELLENT (90-100), VERY_GOOD (80-89), GOOD (70-79), SATISFACTORY (60-69), NEEDS_IMPROVEMENT (<60)
- **PeerRating**: EXCELLENT, VERY_GOOD, GOOD, SATISFACTORY, NEEDS_IMPROVEMENT
- **GoalStatus**: NOT_STARTED, IN_PROGRESS, COMPLETED, CANCELLED

---

## 🔐 الصلاحيات (14 Permissions)

### Evaluation Periods:
- `evaluation:periods:read` - عرض دورات التقييم
- `evaluation:periods:create` - إنشاء دورة تقييم
- `evaluation:periods:update` - تعديل دورة تقييم
- `evaluation:periods:delete` - حذف دورة تقييم
- `evaluation:periods:manage` - إدارة دورات التقييم (فتح/إغلاق)

### Evaluation Criteria:
- `evaluation:criteria:read` - عرض معايير التقييم
- `evaluation:criteria:create` - إنشاء معيار تقييم
- `evaluation:criteria:update` - تعديل معيار تقييم
- `evaluation:criteria:delete` - حذف معيار تقييم

### Evaluation Forms:
- `evaluation:forms:view-own` - عرض تقييمي الخاص
- `evaluation:forms:view-all` - عرض جميع التقييمات
- `evaluation:forms:self-evaluate` - التقييم الذاتي
- `evaluation:forms:manager-evaluate` - تقييم المرؤوسين
- `evaluation:forms:hr-review` - مراجعة HR
- `evaluation:forms:gm-approval` - موافقة المدير العام

### Peer & Goals:
- `evaluation:peer:submit` - تقديم تقييم الأقران
- `evaluation:goals:manage` - إدارة الأهداف

---

## 📡 API Endpoints

### 1. Evaluation Periods

```http
GET /api/v1/evaluation-periods
```
عرض جميع دورات التقييم

```http
GET /api/v1/evaluation-periods/:id
```
عرض دورة تقييم واحدة

```http
POST /api/v1/evaluation-periods
Content-Type: application/json
Authorization: Bearer <token>

{
  "code": "EVAL2026",
  "nameAr": "تقييم الأداء 2026",
  "nameEn": "Performance Evaluation 2026",
  "startDate": "2026-01-01",
  "endDate": "2026-12-31"
}
```
إنشاء دورة تقييم جديدة

```http
PATCH /api/v1/evaluation-periods/:id
Authorization: Bearer <token>

{
  "nameAr": "تقييم الأداء السنوي 2026",
  "endDate": "2026-12-15"
}
```
تعديل دورة تقييم

```http
POST /api/v1/evaluation-periods/:id/open
Authorization: Bearer <token>
```
فتح دورة التقييم (تصبح نشطة)

```http
POST /api/v1/evaluation-periods/:id/close
Authorization: Bearer <token>
```
إغلاق دورة التقييم

```http
DELETE /api/v1/evaluation-periods/:id
Authorization: Bearer <token>
```
حذف دورة تقييم

---

### 2. Evaluation Criteria

```http
GET /api/v1/evaluation-criteria
```
عرض جميع معايير التقييم

```http
GET /api/v1/evaluation-criteria?category=PERFORMANCE
```
فلترة المعايير حسب الفئة

```http
GET /api/v1/evaluation-criteria/:id
```
عرض معيار واحد

```http
POST /api/v1/evaluation-criteria
Content-Type: application/json
Authorization: Bearer <token>

{
  "code": "PERF001",
  "nameAr": "جودة العمل",
  "nameEn": "Work Quality",
  "descriptionAr": "مستوى جودة الأعمال المنجزة",
  "descriptionEn": "Quality level of completed work",
  "weight": 2.0,
  "maxScore": 5,
  "category": "PERFORMANCE",
  "displayOrder": 1
}
```
إنشاء معيار تقييم جديد

```http
PATCH /api/v1/evaluation-criteria/:id
Authorization: Bearer <token>

{
  "weight": 2.5,
  "isActive": true
}
```
تعديل معيار تقييم

```http
DELETE /api/v1/evaluation-criteria/:id
Authorization: Bearer <token>
```
حذف معيار تقييم

---

### 3. Evaluation Forms (الأهم)

#### 3.1 عرض التقييمات

```http
GET /api/v1/evaluation-forms/my
Authorization: Bearer <token>
```
عرض تقييمي الخاص (للدورة النشطة)

```http
GET /api/v1/evaluation-forms/my?periodId=xxx
Authorization: Bearer <token>
```
عرض تقييمي لدورة محددة

```http
GET /api/v1/evaluation-forms/pending-my-review
Authorization: Bearer <token>
```
التقييمات المعلقة التي يجب علي مراجعتها (كمدير)

```http
GET /api/v1/evaluation-forms
Authorization: Bearer <token>
Permission: evaluation:forms:view-all
```
عرض جميع التقييمات (HR)

```http
GET /api/v1/evaluation-forms/:id
Authorization: Bearer <token>
```
عرض تقييم واحد مع جميع التفاصيل

#### 3.2 التقييم الذاتي (Self Evaluation)

```http
PATCH /api/v1/evaluation-forms/:id/self
Content-Type: application/json
Authorization: Bearer <token>

{
  "selfComments": "أشعر أنني حققت أهدافي بنجاح...",
  "sections": [
    {
      "criteriaId": "criteria-uuid-1",
      "selfScore": 4,
      "selfComments": "قمت بتحسين جودة العمل بشكل ملحوظ"
    },
    {
      "criteriaId": "criteria-uuid-2",
      "selfScore": 5,
      "selfComments": "التزمت بجميع المواعيد المحددة"
    }
  ]
}
```
حفظ التقييم الذاتي (مسودة)

```http
POST /api/v1/evaluation-forms/:id/self/submit
Authorization: Bearer <token>
```
تقديم التقييم الذاتي (نهائي - لا يمكن التعديل بعدها)

#### 3.3 تقييم المدير (Manager Evaluation)

```http
PATCH /api/v1/evaluation-forms/:id/manager
Content-Type: application/json
Authorization: Bearer <token>
Permission: evaluation:forms:manager-evaluate

{
  "managerComments": "الموظف يؤدي بشكل جيد ويلتزم بالمواعيد",
  "managerStrengths": "- دقيق في العمل\n- متعاون مع الفريق\n- سريع في التعلم",
  "managerWeaknesses": "- يحتاج تحسين مهارات التواصل الكتابي\n- يحتاج المزيد من المبادرة",
  "managerRecommendations": "أوصي بمنح زيادة راتب بنسبة 10%",
  "sections": [
    {
      "criteriaId": "criteria-uuid-1",
      "managerScore": 4,
      "managerComments": "جيد جداً"
    },
    {
      "criteriaId": "criteria-uuid-2",
      "managerScore": 3,
      "managerComments": "جيد ولكن يحتاج تحسين"
    }
  ]
}
```
حفظ تقييم المدير (مسودة)

```http
POST /api/v1/evaluation-forms/:id/manager/submit
Authorization: Bearer <token>
Permission: evaluation:forms:manager-evaluate
```
تقديم تقييم المدير (نهائي)

#### 3.4 مراجعة HR

```http
POST /api/v1/evaluation-forms/:id/hr-review
Content-Type: application/json
Authorization: Bearer <token>
Permission: evaluation:forms:hr-review

{
  "hrComments": "التقييم عادل ومناسب. الموظف يستحق الزيادة المقترحة.",
  "hrRecommendation": "SALARY_INCREASE"
}
```
مراجعة HR للتقييم

**HRRecommendation Options:**
- `PROMOTION` - ترقية
- `SALARY_INCREASE` - زيادة راتب
- `BONUS` - مكافأة
- `TRAINING` - تدريب
- `WARNING` - إنذار
- `TERMINATION` - إنهاء خدمة
- `NO_ACTION` - لا إجراء

#### 3.5 موافقة المدير العام (GM Approval)

```http
POST /api/v1/evaluation-forms/:id/gm-approval
Content-Type: application/json
Authorization: Bearer <token>
Permission: evaluation:forms:gm-approval

{
  "gmStatus": "APPROVED",
  "gmComments": "موافق على التوصية. يتم منح زيادة 10%."
}
```
موافقة المدير العام النهائية

**gmStatus Options:**
- `APPROVED` - موافق
- `REJECTED` - مرفوض
- `NEEDS_REVISION` - يحتاج مراجعة

---

### 4. Peer Evaluations (تقييمات الأقران)

```http
POST /api/v1/peer-evaluations/forms/:formId/peer
Content-Type: application/json
Authorization: Bearer <token>

{
  "rating": "VERY_GOOD",
  "strengths": "متعاون جداً ودائماً مستعد للمساعدة",
  "improvements": "يحتاج إلى تحسين إدارة الوقت قليلاً",
  "comments": "زميل ممتاز في العمل",
  "isAnonymous": true
}
```
تقديم تقييم لزميل

**PeerRating Options:**
- `EXCELLENT` - ممتاز
- `VERY_GOOD` - جيد جداً
- `GOOD` - جيد
- `SATISFACTORY` - مقبول
- `NEEDS_IMPROVEMENT` - يحتاج تحسين

```http
GET /api/v1/peer-evaluations/forms/:formId/peers
Authorization: Bearer <token>
```
عرض تقييمات الأقران لنموذج معين (مع إخفاء الأسماء إذا كانت anonymous)

---

### 5. Employee Goals (أهداف الموظف)

```http
GET /api/v1/employee-goals/forms/:formId
Authorization: Bearer <token>
```
عرض جميع الأهداف لنموذج تقييم

```http
POST /api/v1/employee-goals/forms/:formId
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "تحسين سرعة الأداء في المشاريع",
  "description": "زيادة الإنتاجية بنسبة 20% في المشاريع المستقبلية",
  "targetDate": "2026-06-30",
  "weight": 1.5
}
```
إنشاء هدف جديد

```http
PATCH /api/v1/employee-goals/:id
Content-Type: application/json
Authorization: Bearer <token>

{
  "selfAchievement": 80,
  "selfComments": "تم تحقيق 80% من الهدف حتى الآن. تحسنت سرعة الإنجاز بشكل ملحوظ."
}
```
تحديث الهدف (تقييم ذاتي)

```http
PATCH /api/v1/employee-goals/:id
Content-Type: application/json
Authorization: Bearer <token>
Permission: evaluation:forms:manager-evaluate

{
  "managerAchievement": 75,
  "managerComments": "تحسن ملحوظ لكن ما زال هناك مجال للتطوير",
  "status": "IN_PROGRESS"
}
```
تحديث الهدف (تقييم المدير)

```http
DELETE /api/v1/employee-goals/:id
Authorization: Bearer <token>
```
حذف هدف

---

## 🔄 سير العمل (Workflow)

### المسار الكامل للتقييم:

```
1. HR: إنشاء دورة تقييم → فتح الدورة
   ↓
2. HR: يتم إنشاء نماذج تقييم تلقائياً لجميع الموظفين
   ↓
3. الموظف: التقييم الذاتي (Self Evaluation)
   - حفظ مسودة (PATCH /self)
   - تقديم نهائي (POST /self/submit)
   - الحالة: PENDING_SELF → SELF_SUBMITTED
   ↓
4. المدير: تقييم المرؤوس (Manager Evaluation)
   - مراجعة التقييم الذاتي
   - حفظ تقييم المدير (PATCH /manager)
   - تقديم نهائي (POST /manager/submit)
   - الحالة: PENDING_MANAGER → MANAGER_SUBMITTED
   ↓
5. الزملاء: تقييم الأقران (اختياري)
   - POST /peer-evaluations
   ↓
6. HR: المراجعة النهائية (HR Review)
   - مراجعة جميع التقييمات
   - POST /hr-review
   - إعطاء توصية (ترقية/زيادة/مكافأة/...)
   - الحالة: PENDING_HR_REVIEW → HR_REVIEWED
   ↓
7. المدير العام: الموافقة النهائية (GM Approval)
   - POST /gm-approval
   - الموافقة أو الرفض
   - الحالة: PENDING_GM_APPROVAL → COMPLETED
   ↓
8. النتيجة النهائية:
   - Final Score (محسوب تلقائياً)
   - Final Rating (EXCELLENT, VERY_GOOD, GOOD, SATISFACTORY, NEEDS_IMPROVEMENT)
```

---

## 🧮 حساب النتيجة (Score Calculation)

### 1. نتيجة كل معيار:
```
criteriaScore = (selfScore + managerScore) / 2
weightedScore = criteriaScore * criteria.weight
```

### 2. النتيجة الكلية:
```
totalWeightedScore = sum(all weightedScores)
totalWeight = sum(all criteria.weights)
finalScore = (totalWeightedScore / totalWeight) * 20
```

### 3. التقدير النهائي:
```
finalScore >= 90  → EXCELLENT
finalScore >= 80  → VERY_GOOD
finalScore >= 70  → GOOD
finalScore >= 60  → SATISFACTORY
finalScore < 60   → NEEDS_IMPROVEMENT
```

---

## 📊 البيانات الأولية (Seed Data)

### 12 معيار تقييم:

**PERFORMANCE (الأداء الوظيفي):**
1. جودة العمل - Work Quality
2. الإنتاجية - Productivity
3. الالتزام بالمواعيد - Meeting Deadlines

**BEHAVIOR (السلوك المهني):**
4. الانضباط الوظيفي - Professional Discipline
5. التعاون مع الفريق - Team Collaboration
6. الاحترافية - Professionalism

**SKILLS (المهارات):**
7. المهارات الفنية - Technical Skills
8. مهارات التواصل - Communication Skills

**ACHIEVEMENT (الإنجازات):**
9. تحقيق الأهداف - Goal Achievement
10. المبادرة والابتكار - Initiative and Innovation

**DEVELOPMENT (التطوير الذاتي):**
11. التعلم والتطوير - Learning and Development
12. القيادة والإشراف - Leadership and Supervision

### دورة تقييم واحدة:
- **Code**: EVAL2026
- **Name**: تقييم الأداء 2026 / Performance Evaluation 2026
- **Period**: 01/01/2026 - 31/12/2026
- **Status**: OPEN

---

## 🧪 الاختبار

### استخدام Postman Collection:

1. **استيراد الـ Collection:**
   ```
   File → Import → evaluation-service.postman_collection.json
   ```

2. **تسجيل الدخول:**
   ```
   Auth → Login
   يتم حفظ TOKEN تلقائياً
   ```

3. **إنشاء دورة تقييم:**
   ```
   Evaluation Periods → Create Period
   ```

4. **إنشاء معايير تقييم:**
   ```
   Evaluation Criteria → Create Criteria
   ```

5. **اختبار سير العمل:**
   ```
   a) My Evaluation → Get formId
   b) Save Self Evaluation
   c) Submit Self Evaluation
   d) Save Manager Evaluation
   e) Submit Manager Evaluation
   f) HR Review
   g) GM Approval
   ```

6. **تقييم الأقران:**
   ```
   Peer Evaluations → Submit Peer Evaluation
   ```

7. **إدارة الأهداف:**
   ```
   Employee Goals → Create/Update/Delete
   ```

---

## 🚀 التشغيل المحلي

### 1. تشغيل الخدمة فقط:

```bash
cd apps/evaluation
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

الخدمة ستعمل على: `http://localhost:4005`

### 2. تشغيل مع Docker:

```bash
# بناء الخدمة
docker-compose build evaluation

# تشغيل جميع الخدمات
docker-compose up -d

# Migration
docker exec -it myapiplatform-evaluation npx prisma migrate deploy

# Seed
docker exec -it myapiplatform-evaluation npm run prisma:seed
```

الوصول عبر Gateway: `http://localhost:5000/api/v1/evaluation-*`

---

## 📝 ملاحظات مهمة

### ✅ النقاط القوية:
- **سير عمل كامل** من التقييم الذاتي حتى موافقة المدير العام
- **حساب تلقائي** للنتائج بناءً على الأوزان
- **تقييم متعدد المستويات**: ذاتي، مدير، أقران، HR، GM
- **مرونة في المعايير**: يمكن إضافة/تعديل معايير التقييم حسب الحاجة
- **أمان كامل**: JWT authentication + Permission-based authorization
- **تدقيق كامل**: EvaluationHistory يسجل جميع التغييرات

### ⚠️ القيود الحالية:
- يجب وجود Employee في Users Service (employeeId reference)
- يجب وجود Manager في Users Service (evaluatorId reference)
- التقييم الذاتي والمدير يجب أن يتم بالترتيب (لا يمكن للمدير التقييم قبل الموظف)
- لا يمكن تعديل التقييم بعد Submit

### 🔄 التحسينات المستقبلية:
- إشعارات تلقائية عند كل مرحلة
- تقارير وتحليلات متقدمة
- مقارنة الأداء بين الفترات
- تصدير التقييمات PDF/Excel
- لوحة تحكم تفاعلية

---

## 🎯 الخلاصة

خدمة التقييم جاهزة للاستخدام مع:
- ✅ 7 جداول في قاعدة البيانات
- ✅ 9 أنواع (Enums)
- ✅ 14 صلاحية
- ✅ 37 endpoint
- ✅ سير عمل كامل
- ✅ Postman Collection للاختبار
- ✅ بيانات أولية (12 معيار + 1 دورة)

**جميع الملفات جاهزة للرفع على السيرفر!** 🚀
