# خطة التعديلات والتحسينات الشاملة - نظام إدارة الموارد البشرية

> هذا الملف يحتوي على جميع التعديلات المطلوبة مع شرح تفصيلي لكل تعديل، آلية التنفيذ البرمجي، والفوائد المتوقعة.

---

## الفهرس

- [المرحلة 1: تعديلات فورية (حرجة أمنياً)](#المرحلة-1-تعديلات-فورية-حرجة-أمنياً)
  - [1.1 إصلاح CORS](#11-إصلاح-cors)
  - [1.2 إضافة Rate Limiting](#12-إضافة-rate-limiting)
  - [1.3 إضافة Helmet Security Headers](#13-إضافة-helmet-security-headers)
  - [1.4 إصلاح خلل صلاحيات Refresh Token](#14-إصلاح-خلل-صلاحيات-refresh-token)
  - [1.5 إزالة القيم الافتراضية لـ JWT Secrets](#15-إزالة-القيم-الافتراضية-لـ-jwt-secrets)
- [المرحلة 2: تعديلات عالية الأولوية](#المرحلة-2-تعديلات-عالية-الأولوية)
  - [2.1 كتابة اختبارات حقيقية](#21-كتابة-اختبارات-حقيقية)
  - [2.2 إضافة Structured Logging](#22-إضافة-structured-logging)
  - [2.3 إعداد CI/CD Pipeline](#23-إعداد-cicd-pipeline)
  - [2.4 توحيد الحزمة المشتركة](#24-توحيد-الحزمة-المشتركة-packagesshared)
  - [2.5 توحيد تسمية الصلاحيات](#25-توحيد-تسمية-الصلاحيات)
- [المرحلة 3: تعديلات متوسطة الأولوية](#المرحلة-3-تعديلات-متوسطة-الأولوية)
  - [3.1 بناء نظام الرواتب](#31-بناء-نظام-الرواتب)
  - [3.2 إضافة نظام الإشعارات](#32-إضافة-نظام-الإشعارات)
  - [3.3 إضافة Swagger UI](#33-إضافة-swagger-ui)
  - [3.4 إضافة Redis Caching](#34-إضافة-redis-caching)
  - [3.5 تطوير خدمة التقارير](#35-تطوير-خدمة-التقارير)

---

# المرحلة 1: تعديلات فورية (حرجة أمنياً)

> هذه التعديلات يجب تنفيذها **قبل أي نشر** للمشروع. تركها يعرض النظام لاختراقات أمنية خطيرة.

---

## 1.1 إصلاح CORS

### ما هي المشكلة؟

**CORS** (Cross-Origin Resource Sharing) هو نظام أمان في المتصفح يمنع المواقع الأخرى من استدعاء API الخاص بك.

حالياً في `apps/gateway/src/main.ts` و `apps/evaluation/src/main.ts`:

```typescript
// ❌ الكود الحالي - خطير جداً
app.enableCors({
  origin: true,        // يسمح لأي موقع في العالم باستدعاء API
  credentials: true,   // يسمح بإرسال الكوكيز والتوكنات
});
```

**الخطر:** أي موقع خبيث يمكنه إرسال طلبات لـ API باسم المستخدم المسجل دخوله. مثلاً:
- موقع `hacker.com` يمكنه استدعاء `your-api.com/api/v1/employees` وسرقة بيانات الموظفين
- يمكن تنفيذ عمليات حذف أو تعديل بدون علم المستخدم

### آلية الإصلاح

**الملفات المتأثرة:**
- `apps/gateway/src/main.ts` (السطر 17-20)
- `apps/evaluation/src/main.ts` (السطر 9-12)

**الكود الجديد في `apps/gateway/src/main.ts`:**

```typescript
// ✅ الكود الآمن
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(origin => origin.trim());

app.enableCors({
  origin: (origin, callback) => {
    // السماح بالطلبات بدون origin (مثل تطبيقات الموبايل أو Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Accept-Language'],
  maxAge: 86400, // cache preflight لمدة 24 ساعة
});
```

**إضافة في `docker-compose.yml`:**

```yaml
gateway:
  environment:
    ALLOWED_ORIGINS: "http://localhost:3000,https://your-domain.com"
```

**إزالة CORS من الخدمات الداخلية:**

بما أن Gateway هو نقطة الدخول الوحيدة، يجب إزالة CORS من `apps/evaluation/src/main.ts` لأن الخدمات الداخلية لا يجب أن تكون متاحة مباشرة من المتصفح.

### الفوائد

| الفائدة | الشرح |
|---------|-------|
| منع هجمات CSRF | المواقع الخبيثة لا تستطيع استدعاء API |
| حماية بيانات المستخدمين | لا يمكن سرقة البيانات عبر مواقع أخرى |
| تحكم دقيق | تحديد المصادر المسموحة عبر environment variables |
| مرونة البيئات | بيئة التطوير تسمح بـ localhost، الإنتاج بالدومين الحقيقي فقط |

---

## 1.2 إضافة Rate Limiting

### ما هي المشكلة؟

لا يوجد أي تحديد لعدد الطلبات المسموح بها. هذا يعني:
- يمكن لمهاجم تجربة ملايين كلمات المرور على `/auth/login` (Brute Force Attack)
- يمكن إرسال آلاف الطلبات في الثانية لإسقاط الخادم (DoS Attack)
- لا توجد حماية من الاستخدام المفرط للـ API

### آلية الإصلاح

**1. تثبيت الحزمة في Gateway:**

```bash
cd apps/gateway
npm install @nestjs/throttler
```

**2. تعديل `apps/gateway/src/app.module.ts`:**

```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',    // حماية قصيرة المدى
        ttl: 1000,        // كل ثانية
        limit: 10,        // 10 طلبات كحد أقصى
      },
      {
        name: 'medium',   // حماية متوسطة المدى
        ttl: 60000,       // كل دقيقة
        limit: 100,       // 100 طلب كحد أقصى
      },
      {
        name: 'long',     // حماية طويلة المدى
        ttl: 3600000,     // كل ساعة
        limit: 1000,      // 1000 طلب كحد أقصى
      },
    ]),
    // ... باقي الـ imports
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

**3. تعديل `apps/auth/src/auth/auth.controller.ts` لحماية أقوى على Login:**

```bash
cd apps/auth
npm install @nestjs/throttler
```

```typescript
import { Throttle, SkipThrottle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {

  // 5 محاولات تسجيل دخول فقط كل دقيقة
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    return this.authService.login(body.username, body.password);
  }

  // 3 محاولات تجديد توكن كل دقيقة
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshToken(body.refreshToken);
  }

  // Health check بدون قيود
  @SkipThrottle()
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
```

**4. رسالة خطأ مخصصة عند تجاوز الحد:**

```typescript
// apps/gateway/src/common/filters/throttler-exception.filter.ts
import { Catch, ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';

@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  catch(exception: ThrottlerException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    response.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'لقد تجاوزت الحد المسموح من الطلبات. يرجى المحاولة لاحقاً.',
        retryAfter: 60,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
}
```

### الفوائد

| الفائدة | الشرح |
|---------|-------|
| منع Brute Force | 5 محاولات تسجيل دخول فقط/دقيقة يمنع تخمين كلمات المرور |
| منع DoS | تحديد 1000 طلب/ساعة يحمي من إسقاط الخادم |
| حماية الموارد | منع استهلاك CPU/Memory من الطلبات المفرطة |
| تجربة مستخدم أفضل | المستخدمون الشرعيون لا يتأثرون بالحدود المعقولة |

---

## 1.3 إضافة Helmet Security Headers

### ما هي المشكلة؟

المتصفحات تعتمد على HTTP Headers لتطبيق سياسات الأمان. حالياً الخادم لا يرسل أي headers أمنية:
- لا يوجد حماية من **Clickjacking** (إخفاء الموقع داخل iframe خبيث)
- لا يوجد حماية من **XSS** (حقن سكربتات خبيثة)
- لا يوجد حماية من **MIME Sniffing** (تنفيذ ملفات كأنها كود)
- لا يوجد إجبار على **HTTPS**

### آلية الإصلاح

**1. تثبيت الحزمة في Gateway:**

```bash
cd apps/gateway
npm install helmet
```

**2. تعديل `apps/gateway/src/main.ts`:**

```typescript
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ إضافة Security Headers
  app.use(helmet({
    // منع عرض الموقع داخل iframe (حماية من Clickjacking)
    frameguard: { action: 'deny' },

    // منع المتصفح من تخمين نوع المحتوى
    noSniff: true,

    // تفعيل حماية XSS المدمجة في المتصفح
    xssFilter: true,

    // إخفاء معلومات الخادم
    hidePoweredBy: true,

    // إجبار HTTPS (فعّل في الإنتاج فقط)
    hsts: process.env.NODE_ENV === 'production'
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,

    // سياسة المحتوى - تعطيل في API (مطلوب فقط لمواقع الويب)
    contentSecurityPolicy: false,
  }));

  // ... باقي الإعدادات
}
```

**Headers التي ستُضاف تلقائياً:**

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
X-Download-Options: noopen
X-Permitted-Cross-Domain-Policies: none
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### الفوائد

| الفائدة | الشرح |
|---------|-------|
| منع Clickjacking | `X-Frame-Options: DENY` يمنع تضمين الموقع في iframe |
| منع MIME Sniffing | `X-Content-Type-Options: nosniff` يمنع تنفيذ ملفات خبيثة |
| حماية XSS | `X-XSS-Protection` يفعّل فلتر XSS في المتصفح |
| إخفاء التقنية | إزالة header `X-Powered-By: Express` يمنع المهاجم من معرفة التقنية |
| إجبار HTTPS | `HSTS` يضمن الاتصال المشفر دائماً |

---

## 1.4 إصلاح خلل صلاحيات Refresh Token

### ما هي المشكلة؟

في `apps/auth/src/auth/auth.service.ts` السطر 187-188:

```typescript
// ❌ الكود الحالي - خلل خطير
// TODO: جيب الـ permissions الحقيقية من الـ DB
const permissions = ['users:read', 'users:create', 'users:update', 'users:delete'];
```

**الخطر الفعلي:**
1. مستخدم بدور `employee` يسجل دخوله → يحصل على صلاحياته الحقيقية (مثلاً: `leave_requests:create` فقط)
2. بعد 15 دقيقة ينتهي Access Token → يطلب تجديد عبر Refresh Token
3. يحصل على Access Token جديد بصلاحيات **مختلفة تماماً**: `users:read, users:create, users:update, users:delete`
4. **موظف عادي أصبح يملك صلاحيات إدارة المستخدمين!**

### آلية الإصلاح

**الملف:** `apps/auth/src/auth/auth.service.ts`

**استبدال كود refreshToken (من السطر ~170 إلى ~209):**

```typescript
async refreshToken(refreshTokenValue: string) {
  // 1. التحقق من صحة Refresh Token
  let payload: any;
  try {
    payload = jwt.verify(refreshTokenValue, this.refreshSecret);
  } catch {
    throw new UnauthorizedException('Invalid or expired refresh token');
  }

  // 2. التحقق من وجود التوكن في قاعدة البيانات وأنه غير ملغي
  const storedToken = await this.prisma.refreshToken.findFirst({
    where: {
      token: refreshTokenValue,
      revoked: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (!storedToken) {
    throw new UnauthorizedException('Refresh token has been revoked or expired');
  }

  // 3. إلغاء التوكن القديم (Token Rotation)
  await this.prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revoked: true },
  });

  // 4. ✅ جلب الصلاحيات الحقيقية من قاعدة البيانات
  const userId = payload.sub;
  const username = payload.username;

  // جلب أدوار المستخدم
  const userRoles = await this.prisma.$queryRaw<{ roleName: string }[]>`
    SELECT r.name as "roleName"
    FROM users.user_roles ur
    INNER JOIN users.roles r ON ur."roleId" = r.id
    INNER JOIN users.users u ON ur."userId" = u.id
    WHERE u.id = ${userId} AND r."deletedAt" IS NULL
  `;

  let permissions: string[] = [];

  // التحقق من super_admin
  const isSuperAdmin = userRoles.some(r => r.roleName === 'super_admin');

  if (isSuperAdmin) {
    // نفس قائمة الصلاحيات الكاملة الموجودة في login
    permissions = this.getAllPermissions();
  } else {
    // جلب الصلاحيات الفعلية من role_permissions
    const rolePermissions = await this.prisma.$queryRaw<{ permissionName: string }[]>`
      SELECT DISTINCT p.name as "permissionName"
      FROM users.role_permissions rp
      INNER JOIN users.permissions p ON rp."permissionId" = p.id
      INNER JOIN users.user_roles ur ON rp."roleId" = ur."roleId"
      INNER JOIN users.users u ON ur."userId" = u.id
      WHERE u.id = ${userId}
    `;
    permissions = rolePermissions.map(p => p.permissionName);
  }

  // 5. إصدار توكنات جديدة بالصلاحيات الحقيقية
  const newAccessToken = this.signAccessToken(userId, username, permissions);
  const newRefreshToken = this.signRefreshToken(userId, username);

  // 6. حفظ Refresh Token الجديد
  const decoded = jwt.decode(newRefreshToken) as any;
  await this.prisma.refreshToken.create({
    data: {
      token: newRefreshToken,
      userId,
      expiresAt: new Date(decoded.exp * 1000),
      revoked: false,
    },
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

// ✅ استخراج قائمة الصلاحيات الكاملة كدالة مستقلة
private getAllPermissions(): string[] {
  return [
    'users:read', 'users:create', 'users:update', 'users:delete', 'users:assign_roles',
    'employees:read', 'employees:create', 'employees:update', 'employees:delete',
    'departments:read', 'departments:create', 'departments:update', 'departments:delete',
    'roles:read', 'roles:create', 'roles:update', 'roles:delete',
    'job-titles:read', 'job-titles:create', 'job-titles:update', 'job-titles:delete',
    'job-grades:read', 'job-grades:create', 'job-grades:update', 'job-grades:delete',
    // ... باقي الصلاحيات
  ];
}
```

### الفوائد

| الفائدة | الشرح |
|---------|-------|
| إصلاح ثغرة تصعيد الصلاحيات | الموظف العادي لن يحصل على صلاحيات إدارية بعد تجديد التوكن |
| تحديث الصلاحيات تلقائياً | إذا تم تغيير دور المستخدم، التغيير يظهر عند تجديد التوكن |
| اتساق النظام | نفس المنطق في login و refresh |
| سحب الصلاحيات فعّال | إزالة دور من مستخدم تسري خلال 15 دقيقة كحد أقصى |

---

## 1.5 إزالة القيم الافتراضية لـ JWT Secrets

### ما هي المشكلة؟

في عدة ملفات عبر المشروع:

```typescript
// ❌ موجود في 6+ ملفات
process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me'
process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me'
```

**الخطر:**
- إذا نُسي تعيين environment variable في الإنتاج → الخادم يعمل بكلمة سر **معروفة للجميع**
- أي شخص يقرأ الكود المصدري يعرف الـ secret
- يمكنه توليد JWT tokens صالحة والوصول لأي حساب

### آلية الإصلاح

**1. إنشاء دالة تحقق مركزية في كل خدمة:**

```typescript
// apps/auth/src/config/env.validation.ts
export function validateEnvironment() {
  const required = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'DATABASE_URL',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `\n❌ Missing required environment variables:\n` +
      missing.map(key => `   - ${key}`).join('\n') +
      `\n\nPlease set them in your .env file or environment.\n`
    );
  }

  // التحقق من قوة JWT Secret
  if (process.env.JWT_ACCESS_SECRET!.length < 32) {
    throw new Error(
      '❌ JWT_ACCESS_SECRET must be at least 32 characters long for security.'
    );
  }

  if (process.env.JWT_REFRESH_SECRET!.length < 32) {
    throw new Error(
      '❌ JWT_REFRESH_SECRET must be at least 32 characters long for security.'
    );
  }
}
```

**2. استدعاء التحقق عند بدء التشغيل في `main.ts`:**

```typescript
// apps/auth/src/main.ts
import { validateEnvironment } from './config/env.validation';

async function bootstrap() {
  // ✅ التحقق أولاً قبل أي شيء
  validateEnvironment();

  const app = await NestFactory.create(AppModule);
  // ...
}
```

**3. إزالة القيم الافتراضية من جميع الملفات:**

```typescript
// ❌ قبل
private accessSecret = process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me';

// ✅ بعد
private accessSecret = process.env.JWT_ACCESS_SECRET!;
```

**الملفات التي تحتاج تعديل:**
- `apps/auth/src/auth/auth.service.ts` (السطر 11-12)
- `apps/users/src/app.module.ts` (السطر 17)
- `apps/leave/src/app.module.ts` (السطر 15)
- `apps/attendance/src/common/strategies/jwt.strategy.ts` (السطر 19)
- `apps/requests/src/app.module.ts` (السطر 12)
- `apps/evaluation/src/app.module.ts` (عبر ConfigService - آمن بالفعل)

**4. تحديث `.env.example` بتعليمات واضحة:**

```env
# ⚠️ مطلوب - يجب تعيين قيمة عشوائية قوية (32+ حرف)
# لتوليد قيمة: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
```

### الفوائد

| الفائدة | الشرح |
|---------|-------|
| منع التشغيل بقيم ضعيفة | الخادم يرفض التشغيل بدون secrets قوية |
| اكتشاف مبكر للأخطاء | الخطأ يظهر فوراً عند التشغيل وليس بعد الاختراق |
| فرض طول كافي | 32+ حرف يضمن قوة التشفير |
| توثيق واضح | `.env.example` يشرح كيفية توليد قيم آمنة |

---

# المرحلة 2: تعديلات عالية الأولوية

> هذه التعديلات ضرورية لجودة المشروع واستقراره على المدى الطويل.

---

## 2.1 كتابة اختبارات حقيقية

### ما هي المشكلة؟

المشروع يحتوي على **6 ملفات اختبار فقط** وجميعها stubs فارغة (اختبار "Hello World" فقط):

```typescript
// ❌ الاختبار الحالي - لا قيمة له
it('should return "Hello World!"', () => {
  expect(appController.getHello()).toBe('Hello World!');
});
```

**الخطر:**
- أي تعديل في الكود قد يكسر ميزة موجودة دون أن تعلم
- لا يمكن التأكد من صحة منطق الأعمال (حساب الإجازات، الصلاحيات، إلخ)
- Refactoring مستحيل بأمان
- لا يوجد ضمان أن الـ API يعمل بشكل صحيح

### آلية الإصلاح

**الهيكل المقترح للاختبارات:**

```
apps/auth/src/auth/
├── __tests__/
│   ├── auth.service.spec.ts        # اختبار منطق المصادقة
│   ├── auth.controller.spec.ts     # اختبار الـ endpoints
│   └── auth.e2e.spec.ts            # اختبار كامل من البداية للنهاية

apps/users/src/users/
├── __tests__/
│   ├── users.service.spec.ts
│   ├── employees.service.spec.ts
│   └── roles.service.spec.ts

apps/leave/src/leave-requests/
├── __tests__/
│   ├── leave-requests.service.spec.ts
│   └── leave-balance.service.spec.ts
```

**مثال: اختبار خدمة المصادقة:**

```typescript
// apps/auth/src/auth/__tests__/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  // إعداد بيئة الاختبار
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn(),
            refreshToken: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('login', () => {
    it('يجب أن يرفض اسم مستخدم غير موجود', async () => {
      jest.spyOn(prisma, '$queryRaw').mockResolvedValue([]);

      await expect(service.login('nonexistent', 'password'))
        .rejects.toThrow('Invalid credentials');
    });

    it('يجب أن يرفض كلمة مرور خاطئة', async () => {
      const hashedPassword = await bcrypt.hash('correct_password', 10);
      jest.spyOn(prisma, '$queryRaw').mockResolvedValue([
        { id: '1', username: 'admin', password: hashedPassword },
      ]);

      await expect(service.login('admin', 'wrong_password'))
        .rejects.toThrow('Invalid credentials');
    });

    it('يجب أن يُرجع tokens عند بيانات صحيحة', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      jest.spyOn(prisma, '$queryRaw')
        .mockResolvedValueOnce([{ id: '1', username: 'admin', password: hashedPassword }])
        .mockResolvedValueOnce([{ roleName: 'super_admin' }]);

      jest.spyOn(prisma.refreshToken, 'create').mockResolvedValue({} as any);

      const result = await service.login('admin', 'password123');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.accessToken).toBeTruthy();
    });
  });

  describe('refreshToken', () => {
    it('يجب أن يرفض توكن ملغي', async () => {
      jest.spyOn(prisma.refreshToken, 'findFirst').mockResolvedValue(null);

      await expect(service.refreshToken('revoked-token'))
        .rejects.toThrow();
    });
  });
});
```

**مثال: اختبار صلاحيات:**

```typescript
// apps/users/src/common/guards/__tests__/permissions.guard.spec.ts
describe('PermissionsGuard', () => {
  it('يجب أن يسمح بالوصول عند امتلاك الصلاحية المطلوبة', () => {
    const user = { permissions: ['users:read', 'users:create'] };
    const requiredPermission = 'users:read';

    expect(user.permissions.includes(requiredPermission)).toBe(true);
  });

  it('يجب أن يرفض الوصول عند عدم امتلاك الصلاحية', () => {
    const user = { permissions: ['users:read'] };
    const requiredPermission = 'users:delete';

    expect(user.permissions.includes(requiredPermission)).toBe(false);
  });

  it('يجب أن يسمح بالوصول عند عدم وجود صلاحية مطلوبة على الـ endpoint', () => {
    // إذا الـ endpoint ليس عليه @Permission decorator، يجب السماح
    const requiredPermission = undefined;
    expect(!requiredPermission).toBe(true); // guard returns true
  });
});
```

**تشغيل الاختبارات:**

```bash
# اختبار خدمة واحدة
cd apps/auth && npm test

# اختبار مع تغطية
cd apps/auth && npm run test:cov

# اختبار End-to-End
cd apps/auth && npm run test:e2e
```

### الفوائد

| الفائدة | الشرح |
|---------|-------|
| اكتشاف الأخطاء مبكراً | كل تعديل يُختبر تلقائياً قبل النشر |
| توثيق حي | الاختبارات توضح كيف يعمل الكود |
| Refactoring آمن | يمكنك تعديل الكود بثقة |
| تغطية منطق الأعمال | ضمان صحة حسابات الإجازات والصلاحيات |
| CI/CD فعّال | يمكن رفض الكود الذي يفشل في الاختبارات |

---

## 2.2 إضافة Structured Logging

### ما هي المشكلة؟

المشروع يستخدم `console.log` فقط:

```typescript
// ❌ الاستخدام الحالي
console.log('🚀 Gateway running on port 8000');
console.error('Error:', error.message);
```

**المشاكل:**
- لا يوجد مستويات للتسجيل (debug, info, warn, error)
- لا يوجد تنسيق موحد (JSON)
- لا يمكن البحث أو الفلترة في السجلات
- لا يوجد ربط بين الطلبات (Request ID)
- لا يمكن إرسال السجلات لخدمة مراقبة خارجية

### آلية الإصلاح

**1. تثبيت الحزم في كل خدمة:**

```bash
npm install winston nest-winston
```

**2. إنشاء إعداد Winston مشترك:**

```typescript
// packages/shared/src/logger/logger.config.ts
import * as winston from 'winston';

export function createLoggerConfig(serviceName: string) {
  return {
    transports: [
      // طباعة في Console (للتطوير)
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, context, requestId, ...meta }) => {
            return `[${timestamp}] [${serviceName}] [${level}] [${context || 'App'}] ${requestId ? `[${requestId}] ` : ''}${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
          }),
        ),
      }),

      // كتابة في ملف (للإنتاج)
      new winston.transports.File({
        filename: `logs/${serviceName}-error.log`,
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),

      new winston.transports.File({
        filename: `logs/${serviceName}-combined.log`,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
    ],
  };
}
```

**3. إعداد في كل خدمة:**

```typescript
// apps/auth/src/main.ts
import { WinstonModule } from 'nest-winston';
import { createLoggerConfig } from '@my/shared';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(createLoggerConfig('auth-service')),
  });
  // ...
}
```

**4. استخدام في الخدمات:**

```typescript
// apps/auth/src/auth/auth.service.ts
import { Logger, Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  async login(username: string, password: string) {
    this.logger.log(`Login attempt for user: ${username}`);

    try {
      // ... منطق تسجيل الدخول
      this.logger.log(`Login successful for user: ${username}`);
    } catch (error) {
      this.logger.warn(`Failed login attempt for user: ${username}`, error.stack);
      throw error;
    }
  }
}
```

**5. Request ID Middleware للربط بين السجلات:**

```typescript
// packages/shared/src/middleware/request-id.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    req.requestId = req.headers['x-request-id'] || uuidv4();
    res.setHeader('X-Request-ID', req.requestId);
    next();
  }
}
```

**مثال على الناتج:**

```
// بيئة التطوير (ملوّن وقابل للقراءة)
[2026-03-11T10:30:45Z] [auth-service] [info] [AuthService] [req-abc123] Login attempt for user: admin

// بيئة الإنتاج (JSON للمعالجة الآلية)
{"timestamp":"2026-03-11T10:30:45Z","service":"auth-service","level":"info","context":"AuthService","requestId":"req-abc123","message":"Login attempt for user: admin"}
```

### الفوائد

| الفائدة | الشرح |
|---------|-------|
| تتبع المشاكل | يمكن تتبع أي خطأ من بدايته لنهايته عبر Request ID |
| مستويات واضحة | فصل debug/info/warn/error لسهولة الفلترة |
| تنسيق JSON | يمكن إرسال السجلات لـ ELK Stack أو Datadog |
| تشخيص سريع | معرفة أي خدمة وأي دالة سببت المشكلة |
| تدقيق أمني | تسجيل محاولات تسجيل الدخول الفاشلة |

---

## 2.3 إعداد CI/CD Pipeline

### ما هي المشكلة؟

لا يوجد أي أتمتة للبناء والنشر:
- لا يوجد فحص تلقائي للكود عند كل Push
- لا يوجد تشغيل تلقائي للاختبارات
- النشر يدوي ويعتمد على الشخص
- لا يوجد ضمان أن الكود المدمج يعمل

### آلية الإصلاح

**إنشاء `.github/workflows/ci.yml`:**

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  # ==========================================
  # المرحلة 1: فحص الكود
  # ==========================================
  lint:
    name: 'Lint & Type Check'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: |
          cd apps/auth && npm run lint
          cd ../users && npm run lint
          cd ../leave && npm run lint
          cd ../attendance && npm run lint
          cd ../evaluation && npm run lint
          cd ../requests && npm run lint
          cd ../gateway && npm run lint

  # ==========================================
  # المرحلة 2: الاختبارات
  # ==========================================
  test:
    name: 'Unit Tests'
    runs-on: ubuntu-latest
    needs: lint
    strategy:
      matrix:
        service: [auth, users, leave, attendance, evaluation, requests]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests for ${{ matrix.service }}
        run: cd apps/${{ matrix.service }} && npm test -- --coverage
        env:
          JWT_ACCESS_SECRET: test-secret-for-ci-minimum-32-characters
          JWT_REFRESH_SECRET: test-refresh-secret-for-ci-32-chars
          DATABASE_URL: postgresql://test:test@localhost:5432/test

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: apps/${{ matrix.service }}/coverage/lcov.info
          flags: ${{ matrix.service }}

  # ==========================================
  # المرحلة 3: البناء
  # ==========================================
  build:
    name: 'Build Docker Images'
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Build all services
        run: |
          docker compose build --parallel

  # ==========================================
  # المرحلة 4: النشر (اختياري)
  # ==========================================
  deploy:
    name: 'Deploy to Production'
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - name: Deploy
        run: echo "Add your deployment steps here"
        # مثال: docker compose -f docker-compose.prod.yml up -d
```

### الفوائد

| الفائدة | الشرح |
|---------|-------|
| فحص تلقائي | كل Pull Request يُفحص تلقائياً قبل الدمج |
| اختبارات متوازية | كل خدمة تُختبر بشكل مستقل ومتوازي |
| منع الأخطاء | كود لا يمر من الاختبارات لا يُدمج |
| نشر آمن | النشر فقط من main وبعد نجاح جميع المراحل |
| تقارير التغطية | معرفة نسبة الكود المختبر |

---

## 2.4 توحيد الحزمة المشتركة (packages/shared)

### ما هي المشكلة؟

الحزمة المشتركة `packages/shared` فارغة تماماً:

```typescript
// ❌ المحتوى الحالي
export const helloShared = () => "Hello from @my/shared";
```

بينما **كل خدمة تكرر نفس الكود:**
- `JwtAuthGuard` مكرر في 5 خدمات
- `PermissionsGuard` مكرر في 5 خدمات (بتطبيقات مختلفة!)
- `Permission` decorator مكرر في 5 خدمات
- `HttpExceptionFilter` مكرر في 6 خدمات
- `ResponseInterceptor` مكرر في 5 خدمات
- `JwtStrategy` مكرر في 4 خدمات

**المشاكل:**
- تعديل في Guard يحتاج تعديل في 5 ملفات
- اختلافات غير مقصودة بين الخدمات (مثل @Permission vs @Permissions)
- صيانة صعبة ومكلفة

### آلية الإصلاح

**هيكل الحزمة المشتركة الجديد:**

```
packages/shared/src/
├── index.ts                          # نقطة التصدير الرئيسية
├── guards/
│   ├── jwt-auth.guard.ts             # Guard موحد
│   └── permissions.guard.ts          # Guard موحد
├── decorators/
│   ├── permission.decorator.ts       # @Permission() decorator
│   ├── current-user.decorator.ts     # @CurrentUser() decorator
│   └── employee-id.decorator.ts      # @EmployeeId() decorator
├── interceptors/
│   ├── response.interceptor.ts       # ResponseInterceptor
│   └── employee.interceptor.ts       # EmployeeInterceptor
├── filters/
│   └── http-exception.filter.ts      # GlobalExceptionFilter
├── strategies/
│   └── jwt.strategy.ts               # JwtStrategy
├── middleware/
│   └── request-id.middleware.ts       # RequestIdMiddleware
├── interfaces/
│   ├── jwt-payload.interface.ts       # JwtPayload type
│   └── api-response.interface.ts      # ApiResponse type
└── constants/
    └── permissions.constants.ts       # جميع أسماء الصلاحيات
```

**مثال: Guard موحد للصلاحيات:**

```typescript
// packages/shared/src/guards/permissions.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/permission.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // دعم صلاحية واحدة أو عدة صلاحيات
    const requiredPermissions = this.reflector.getAllAndOverride<string | string[]>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // لا يوجد صلاحية مطلوبة → السماح
    if (!requiredPermissions) return true;

    const request = context.switchToHttp().getRequest();
    const userPermissions: string[] = request.user?.permissions || [];

    // تحويل لمصفوفة إذا كانت قيمة واحدة
    const permissions = Array.isArray(requiredPermissions)
      ? requiredPermissions
      : [requiredPermissions];

    // التحقق: يجب امتلاك أي صلاحية من المطلوبة (OR logic)
    const hasPermission = permissions.some(p => userPermissions.includes(p));

    if (!hasPermission) {
      throw new ForbiddenException({
        code: 'AUTH_INSUFFICIENT_PERMISSIONS',
        message: 'ليس لديك الصلاحية الكافية لهذا الإجراء',
        details: { required: permissions, granted: userPermissions },
      });
    }

    return true;
  }
}
```

**مثال: Decorator موحد:**

```typescript
// packages/shared/src/decorators/permission.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permission';

// يدعم صلاحية واحدة أو عدة صلاحيات
export const Permission = (...permissions: string[]) =>
  SetMetadata(PERMISSION_KEY, permissions.length === 1 ? permissions[0] : permissions);
```

**الاستخدام في الخدمات:**

```typescript
// apps/users/src/users/users.controller.ts
import { Permission, JwtAuthGuard, PermissionsGuard } from '@my/shared';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  @Permission('users:read')
  @Get()
  findAll() { /* ... */ }
}
```

### الفوائد

| الفائدة | الشرح |
|---------|-------|
| DRY (Don't Repeat Yourself) | كل كود مشترك في مكان واحد |
| تناسق | جميع الخدمات تستخدم نفس المنطق بالضبط |
| صيانة سهلة | تعديل واحد يؤثر على جميع الخدمات |
| إصلاح سريع للأخطاء | إصلاح خطأ في Guard يُصلح في جميع الخدمات |
| تقليل حجم الكود | إزالة مئات الأسطر المكررة |

---

## 2.5 توحيد تسمية الصلاحيات

### ما هي المشكلة؟

أسماء الصلاحيات **غير موحدة** عبر الخدمات:

```
users:read                          ← نقطتان
attendance.records.read             ← نقاط
leave_requests:read                 ← شرطة سفلية + نقطتان
evaluation:periods:read             ← نقطتان مزدوجة
```

**المشاكل:**
- مربك للمطورين
- صعب الحفظ والكتابة
- سهل الخطأ في التسمية
- صعب البحث والفلترة

### آلية الإصلاح

**1. اختيار تنسيق موحد:**

```
module:entity:action
```

**أمثلة:**
```
users:users:read          → قراءة المستخدمين
users:employees:create    → إنشاء موظف
leave:requests:approve    → الموافقة على إجازة
attendance:records:read    → قراءة سجلات الحضور
evaluation:forms:review    → مراجعة نماذج التقييم
```

**2. إنشاء ملف مرجعي للصلاحيات:**

```typescript
// packages/shared/src/constants/permissions.constants.ts

export const PERMISSIONS = {
  // ===== وحدة المستخدمين =====
  USERS: {
    READ:          'users:users:read',
    CREATE:        'users:users:create',
    UPDATE:        'users:users:update',
    DELETE:        'users:users:delete',
    ASSIGN_ROLES:  'users:users:assign-roles',
  },
  EMPLOYEES: {
    READ:          'users:employees:read',
    CREATE:        'users:employees:create',
    UPDATE:        'users:employees:update',
    DELETE:        'users:employees:delete',
  },
  DEPARTMENTS: {
    READ:          'users:departments:read',
    CREATE:        'users:departments:create',
    UPDATE:        'users:departments:update',
    DELETE:        'users:departments:delete',
  },
  ROLES: {
    READ:          'users:roles:read',
    CREATE:        'users:roles:create',
    UPDATE:        'users:roles:update',
    DELETE:        'users:roles:delete',
  },
  JOB_TITLES: {
    READ:          'users:job-titles:read',
    CREATE:        'users:job-titles:create',
    UPDATE:        'users:job-titles:update',
    DELETE:        'users:job-titles:delete',
  },
  JOB_GRADES: {
    READ:          'users:job-grades:read',
    CREATE:        'users:job-grades:create',
    UPDATE:        'users:job-grades:update',
    DELETE:        'users:job-grades:delete',
  },

  // ===== وحدة الإجازات =====
  LEAVE_TYPES: {
    READ:          'leave:types:read',
    CREATE:        'leave:types:create',
    UPDATE:        'leave:types:update',
    DELETE:        'leave:types:delete',
  },
  LEAVE_REQUESTS: {
    READ:          'leave:requests:read',
    READ_ALL:      'leave:requests:read-all',
    CREATE:        'leave:requests:create',
    UPDATE:        'leave:requests:update',
    DELETE:        'leave:requests:delete',
    SUBMIT:        'leave:requests:submit',
    APPROVE_MGR:   'leave:requests:approve-manager',
    APPROVE_HR:    'leave:requests:approve-hr',
    CANCEL:        'leave:requests:cancel',
  },
  LEAVE_BALANCES: {
    READ:          'leave:balances:read',
    READ_ALL:      'leave:balances:read-all',
    CREATE:        'leave:balances:create',
    ADJUST:        'leave:balances:adjust',
    INITIALIZE:    'leave:balances:initialize',
    DELETE:        'leave:balances:delete',
    CARRY_OVER:    'leave:balances:carry-over',
  },
  HOLIDAYS: {
    READ:          'leave:holidays:read',
    CREATE:        'leave:holidays:create',
    UPDATE:        'leave:holidays:update',
    DELETE:        'leave:holidays:delete',
  },

  // ===== وحدة الحضور =====
  WORK_SCHEDULES: {
    READ:          'attendance:schedules:read',
    CREATE:        'attendance:schedules:create',
    UPDATE:        'attendance:schedules:update',
    DELETE:        'attendance:schedules:delete',
  },
  ATTENDANCE_RECORDS: {
    READ:          'attendance:records:read',
    READ_OWN:      'attendance:records:read-own',
    CREATE:        'attendance:records:create',
    UPDATE:        'attendance:records:update',
    DELETE:        'attendance:records:delete',
    CHECK_IN:      'attendance:records:check-in',
    CHECK_OUT:     'attendance:records:check-out',
  },
  ATTENDANCE_ALERTS: {
    READ:          'attendance:alerts:read',
    READ_OWN:      'attendance:alerts:read-own',
    CREATE:        'attendance:alerts:create',
    UPDATE:        'attendance:alerts:update',
    DELETE:        'attendance:alerts:delete',
    RESOLVE:       'attendance:alerts:resolve',
  },
  ATTENDANCE_JUSTIFICATIONS: {
    READ:          'attendance:justifications:read',
    READ_OWN:      'attendance:justifications:read-own',
    CREATE_OWN:    'attendance:justifications:create-own',
    MGR_REVIEW:    'attendance:justifications:manager-review',
    HR_REVIEW:     'attendance:justifications:hr-review',
  },
  ATTENDANCE_REPORTS: {
    READ:          'attendance:reports:read',
  },

  // ===== وحدة التقييم =====
  EVAL_PERIODS: {
    READ:          'evaluation:periods:read',
    CREATE:        'evaluation:periods:create',
    UPDATE:        'evaluation:periods:update',
    DELETE:        'evaluation:periods:delete',
    MANAGE:        'evaluation:periods:manage',
  },
  EVAL_CRITERIA: {
    READ:          'evaluation:criteria:read',
    CREATE:        'evaluation:criteria:create',
    UPDATE:        'evaluation:criteria:update',
    DELETE:        'evaluation:criteria:delete',
  },
  EVAL_FORMS: {
    VIEW_OWN:      'evaluation:forms:view-own',
    VIEW_ALL:      'evaluation:forms:view-all',
    SELF_EVAL:     'evaluation:forms:self-evaluate',
    MGR_EVAL:      'evaluation:forms:manager-evaluate',
    HR_REVIEW:     'evaluation:forms:hr-review',
    GM_APPROVAL:   'evaluation:forms:gm-approval',
  },
  EVAL_GOALS: {
    MANAGE:        'evaluation:goals:manage',
  },
  EVAL_PEER: {
    SUBMIT:        'evaluation:peer:submit',
  },

  // ===== وحدة الطلبات =====
  REQUESTS: {
    READ:          'requests:requests:read',
    APPROVE_MGR:   'requests:requests:approve-manager',
    REJECT_MGR:    'requests:requests:reject-manager',
    APPROVE_HR:    'requests:requests:approve-hr',
    REJECT_HR:     'requests:requests:reject-hr',
  },
} as const;

// نوع TypeScript لجميع الصلاحيات
type DeepValues<T> = T extends object ? DeepValues<T[keyof T]> : T;
export type PermissionType = DeepValues<typeof PERMISSIONS>;
```

**3. الاستخدام في Controllers:**

```typescript
// ❌ قبل (سهل الخطأ)
@Permission('users:read')

// ✅ بعد (آمن مع TypeScript autocomplete)
@Permission(PERMISSIONS.USERS.READ)
```

**4. خطوات الترحيل:**
1. إنشاء ملف الثوابت
2. تحديث seed data في قاعدة البيانات
3. تحديث auth.service.ts (قائمة super_admin)
4. تحديث جميع Controllers لاستخدام الثوابت
5. كتابة Migration script لتحديث الصلاحيات الموجودة

### الفوائد

| الفائدة | الشرح |
|---------|-------|
| تنسيق موحد | `module:entity:action` في كل مكان |
| Type Safety | TypeScript يمنع الأخطاء الإملائية |
| Autocomplete | IDE يقترح الصلاحيات المتاحة |
| سهولة البحث | يمكن البحث بالوحدة أو الكيان أو الإجراء |
| مرجع مركزي | مكان واحد لجميع الصلاحيات |

---

# المرحلة 3: تعديلات متوسطة الأولوية

> هذه التعديلات تضيف ميزات مهمة لاكتمال النظام كنظام HR شامل.

---

## 3.1 بناء نظام الرواتب

### ما هي المشكلة؟

نظام HR بدون رواتب كسيارة بدون محرك. الموظفون يحتاجون:
- معالجة رواتب شهرية
- حسم الغياب والتأخير
- إضافة البدلات والمكافآت
- إصدار كشوف رواتب
- حسابات نهاية الخدمة

### آلية الإصلاح

**1. إنشاء خدمة جديدة:**

```bash
mkdir -p apps/payroll-service
```

**2. مخطط قاعدة البيانات (Prisma Schema):**

```prisma
// apps/payroll-service/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["payroll"]
}

// ===== هيكل الراتب =====
model SalaryStructure {
  id              String   @id @default(uuid())
  employeeId      String
  basicSalary     Decimal  @db.Decimal(10, 2)  // الراتب الأساسي
  housingAllowance Decimal @db.Decimal(10, 2)  // بدل سكن
  transportAllowance Decimal @db.Decimal(10, 2) // بدل نقل
  otherAllowances Decimal  @db.Decimal(10, 2)  // بدلات أخرى
  effectiveFrom   DateTime                      // تاريخ السريان
  effectiveTo     DateTime?                     // تاريخ الانتهاء
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  payrollItems    PayrollItem[]

  @@schema("payroll")
  @@map("salary_structures")
}

// ===== دورة الرواتب =====
model PayrollCycle {
  id          String        @id @default(uuid())
  month       Int                               // الشهر (1-12)
  year        Int                               // السنة
  status      PayrollStatus @default(DRAFT)     // حالة الدورة
  processedBy String?                           // معالج الرواتب
  processedAt DateTime?                         // تاريخ المعالجة
  approvedBy  String?                           // المعتمد
  approvedAt  DateTime?                         // تاريخ الاعتماد
  notes       String?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  items       PayrollItem[]

  @@unique([month, year])
  @@schema("payroll")
  @@map("payroll_cycles")
}

enum PayrollStatus {
  DRAFT         // مسودة
  PROCESSING    // قيد المعالجة
  PROCESSED     // تمت المعالجة
  APPROVED      // معتمد
  PAID          // مدفوع

  @@schema("payroll")
}

// ===== بند الراتب لكل موظف =====
model PayrollItem {
  id                  String   @id @default(uuid())
  cycleId             String
  employeeId          String
  salaryStructureId   String

  // الاستحقاقات
  basicSalary         Decimal  @db.Decimal(10, 2)
  housingAllowance    Decimal  @db.Decimal(10, 2)
  transportAllowance  Decimal  @db.Decimal(10, 2)
  otherAllowances     Decimal  @db.Decimal(10, 2)
  overtimePay         Decimal  @db.Decimal(10, 2) @default(0)
  bonuses             Decimal  @db.Decimal(10, 2) @default(0)
  totalEarnings       Decimal  @db.Decimal(10, 2)

  // الاستقطاعات
  absentDeductions    Decimal  @db.Decimal(10, 2) @default(0)  // حسم غياب
  lateDeductions      Decimal  @db.Decimal(10, 2) @default(0)  // حسم تأخير
  socialInsurance     Decimal  @db.Decimal(10, 2) @default(0)  // تأمينات
  otherDeductions     Decimal  @db.Decimal(10, 2) @default(0)
  totalDeductions     Decimal  @db.Decimal(10, 2)

  // الصافي
  netSalary           Decimal  @db.Decimal(10, 2)

  notes               String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  cycle               PayrollCycle     @relation(fields: [cycleId], references: [id])
  salaryStructure     SalaryStructure  @relation(fields: [salaryStructureId], references: [id])

  @@unique([cycleId, employeeId])
  @@schema("payroll")
  @@map("payroll_items")
}
```

**3. خدمة المعالجة الأساسية:**

```typescript
// apps/payroll-service/src/payroll/payroll.service.ts
@Injectable()
export class PayrollService {

  // معالجة رواتب شهر كامل
  async processPayroll(month: number, year: number) {
    // 1. جلب جميع الموظفين النشطين من خدمة المستخدمين
    const employees = await this.fetchActiveEmployees();

    // 2. جلب سجلات الحضور من خدمة الحضور
    const attendanceRecords = await this.fetchAttendanceRecords(month, year);

    // 3. جلب الإجازات من خدمة الإجازات
    const leaveRecords = await this.fetchLeaveRecords(month, year);

    // 4. حساب الراتب لكل موظف
    for (const employee of employees) {
      const salary = await this.calculateSalary(employee, attendanceRecords, leaveRecords);
      await this.savePayrollItem(cycleId, employee.id, salary);
    }
  }

  // حساب راتب موظف واحد
  private async calculateSalary(employee, attendance, leaves) {
    const structure = await this.getSalaryStructure(employee.id);

    // حساب الاستحقاقات
    const totalEarnings = structure.basicSalary
      + structure.housingAllowance
      + structure.transportAllowance
      + structure.otherAllowances
      + this.calculateOvertime(attendance)
      + this.calculateBonuses(employee);

    // حساب الاستقطاعات
    const absentDays = this.calculateAbsentDays(attendance, leaves);
    const dailyRate = structure.basicSalary / 30;
    const absentDeductions = absentDays * dailyRate;

    const lateDays = this.calculateLateDays(attendance);
    const lateDeductions = lateDays * (dailyRate / 4); // ربع يوم لكل تأخير

    const socialInsurance = structure.basicSalary * 0.0975; // 9.75% GOSI

    const totalDeductions = absentDeductions + lateDeductions + socialInsurance;

    return {
      ...structure,
      overtimePay: this.calculateOvertime(attendance),
      totalEarnings,
      absentDeductions,
      lateDeductions,
      socialInsurance,
      totalDeductions,
      netSalary: totalEarnings - totalDeductions,
    };
  }
}
```

**4. إضافة في Gateway:**

```yaml
# docker-compose.yml
payroll:
  build:
    context: .
    dockerfile: apps/payroll-service/Dockerfile
  ports:
    - "4007:4007"
  environment:
    DATABASE_URL: postgresql://postgres:postgres@postgres:5432/platform?schema=payroll
```

### الفوائد

| الفائدة | الشرح |
|---------|-------|
| اكتمال دورة HR | الراتب هو الهدف النهائي من الحضور والإجازات |
| ربط تلقائي | حسم الغياب والتأخير يحسب تلقائياً من سجلات الحضور |
| دقة الحسابات | لا أخطاء يدوية في حساب الرواتب |
| تدقيق مالي | كل بند محسوب ومسجل بالتفصيل |
| كشوف رواتب | إمكانية إصدار كشف راتب لكل موظف |

---

## 3.2 إضافة نظام الإشعارات

### ما هي المشكلة؟

لا توجد أي إشعارات في النظام:
- الموظف لا يعلم أن طلب إجازته وافق عليه المدير
- المدير لا يعلم أن هناك طلبات بحاجة لموافقته
- HR لا يعلم بالتنبيهات الجديدة في الحضور
- لا يوجد تنبيه عند انتهاء رصيد الإجازات

### آلية الإصلاح

**1. إنشاء خدمة الإشعارات:**

```
apps/notification-service/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── notifications/
│   │   ├── notifications.controller.ts    # CRUD + mark as read
│   │   ├── notifications.service.ts       # منطق الإشعارات
│   │   ├── notifications.module.ts
│   │   └── dto/
│   ├── channels/
│   │   ├── email.service.ts               # إرسال بريد إلكتروني
│   │   ├── sms.service.ts                 # إرسال رسائل SMS
│   │   └── in-app.service.ts              # إشعارات داخل التطبيق
│   └── templates/
│       ├── leave-approved.template.ts
│       ├── leave-rejected.template.ts
│       ├── attendance-alert.template.ts
│       └── evaluation-pending.template.ts
```

**2. مخطط قاعدة البيانات:**

```prisma
model Notification {
  id          String             @id @default(uuid())
  userId      String                                    // المستلم
  type        NotificationType                          // نوع الإشعار
  channel     NotificationChannel @default(IN_APP)      // القناة
  title       String                                    // العنوان
  titleAr     String                                    // العنوان بالعربي
  body        String                                    // المحتوى
  bodyAr      String                                    // المحتوى بالعربي
  data        Json?                                     // بيانات إضافية (رابط، معرف الطلب، إلخ)
  isRead      Boolean            @default(false)        // هل قُرئ
  readAt      DateTime?                                 // تاريخ القراءة
  createdAt   DateTime           @default(now())

  @@schema("notifications")
  @@map("notifications")
}

enum NotificationType {
  LEAVE_SUBMITTED            // طلب إجازة مقدم
  LEAVE_APPROVED_MANAGER     // إجازة وافق عليها المدير
  LEAVE_APPROVED_HR          // إجازة وافق عليها HR
  LEAVE_REJECTED             // إجازة مرفوضة
  ATTENDANCE_ALERT           // تنبيه حضور
  EVALUATION_PENDING         // تقييم بحاجة لمراجعة
  REQUEST_SUBMITTED          // طلب عام مقدم
  REQUEST_APPROVED           // طلب عام معتمد
  REQUEST_REJECTED           // طلب عام مرفوض
  SYSTEM_ANNOUNCEMENT        // إعلان نظام

  @@schema("notifications")
}

enum NotificationChannel {
  IN_APP
  EMAIL
  SMS
  ALL

  @@schema("notifications")
}
```

**3. خدمة الإرسال:**

```typescript
@Injectable()
export class NotificationsService {

  // إرسال إشعار عند الموافقة على إجازة
  async notifyLeaveApproved(employeeId: string, leaveRequest: any) {
    await this.send({
      userId: employeeId,
      type: 'LEAVE_APPROVED_MANAGER',
      channel: 'ALL',
      title: 'Leave Request Approved',
      titleAr: 'تمت الموافقة على طلب الإجازة',
      body: `Your leave request from ${leaveRequest.startDate} to ${leaveRequest.endDate} has been approved by your manager.`,
      bodyAr: `تمت الموافقة على طلب إجازتك من ${leaveRequest.startDate} إلى ${leaveRequest.endDate} من قبل المدير.`,
      data: { leaveRequestId: leaveRequest.id },
    });
  }

  // إشعار المدير بطلب جديد بحاجة لموافقة
  async notifyManagerPendingApproval(managerId: string, employeeName: string) {
    await this.send({
      userId: managerId,
      type: 'LEAVE_SUBMITTED',
      channel: 'IN_APP',
      title: 'New Leave Request',
      titleAr: 'طلب إجازة جديد',
      body: `${employeeName} has submitted a leave request pending your approval.`,
      bodyAr: `${employeeName} قدم طلب إجازة بحاجة لموافقتك.`,
    });
  }
}
```

**4. الربط مع الخدمات الحالية:**

الخدمات الحالية (leave, attendance, evaluation) تستدعي خدمة الإشعارات عبر HTTP عند:
- تقديم طلب إجازة → إشعار المدير
- الموافقة/الرفض → إشعار الموظف
- تنبيه حضور جديد → إشعار الموظف والمدير
- تقييم بحاجة لمراجعة → إشعار المراجع

### الفوائد

| الفائدة | الشرح |
|---------|-------|
| تجربة مستخدم أفضل | الموظف يعلم فوراً بحالة طلباته |
| سرعة الاستجابة | المديرون ينتبهون للطلبات المعلقة |
| تقليل التأخير | الموافقات لا تتأخر لأن المدير لم يدخل النظام |
| دعم متعدد القنوات | بريد + SMS + إشعار داخلي |
| دعم العربية | كل إشعار بالعربي والإنجليزي |

---

## 3.3 إضافة Swagger UI

### ما هي المشكلة؟

التوثيق الحالي يدوي في `API_DOCUMENTATION.md` (1805 سطر):
- يجب تحديثه يدوياً عند أي تغيير
- لا يمكن تجربة الـ API مباشرة منه
- لا يعكس التغييرات الأخيرة بالضرورة
- لا يوجد توثيق تفاعلي

### آلية الإصلاح

**1. تثبيت الحزمة في كل خدمة:**

```bash
npm install @nestjs/swagger
```

**2. إعداد Swagger في `main.ts`:**

```typescript
// apps/gateway/src/main.ts (أو كل خدمة على حدة)
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('HR Management System API')
    .setDescription('نظام إدارة الموارد البشرية - التوثيق التفاعلي')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT-auth',
    )
    .addTag('Auth', 'المصادقة وإدارة التوكنات')
    .addTag('Users', 'إدارة المستخدمين')
    .addTag('Employees', 'إدارة الموظفين')
    .addTag('Departments', 'إدارة الأقسام')
    .addTag('Leave', 'إدارة الإجازات')
    .addTag('Attendance', 'إدارة الحضور')
    .addTag('Evaluation', 'إدارة التقييم')
    .addTag('Requests', 'إدارة الطلبات')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,  // حفظ التوكن بين التحديثات
    },
  });

  // ...
}
```

**3. إضافة Decorators على Controllers:**

```typescript
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Employees')
@ApiBearerAuth('JWT-auth')
@Controller('employees')
export class EmployeesController {

  @ApiOperation({
    summary: 'جلب جميع الموظفين',
    description: 'يُرجع قائمة بجميع الموظفين مع دعم الفلترة والصفحات'
  })
  @ApiResponse({ status: 200, description: 'قائمة الموظفين' })
  @ApiResponse({ status: 401, description: 'غير مصرح - توكن غير صالح' })
  @ApiResponse({ status: 403, description: 'ممنوع - صلاحيات غير كافية' })
  @Get()
  findAll() { /* ... */ }
}
```

**4. إضافة Decorators على DTOs:**

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmployeeDto {
  @ApiProperty({
    description: 'الاسم الأول بالعربي',
    example: 'أحمد'
  })
  @IsString()
  firstNameAr: string;

  @ApiPropertyOptional({
    description: 'الاسم الأول بالإنجليزي',
    example: 'Ahmed'
  })
  @IsOptional()
  @IsString()
  firstNameEn?: string;
}
```

**النتيجة:** واجهة تفاعلية على `http://localhost:8000/api/docs`

### الفوائد

| الفائدة | الشرح |
|---------|-------|
| توثيق تلقائي | يتحدث تلقائياً مع تغيير الكود |
| تجربة مباشرة | يمكن تجربة أي endpoint من المتصفح |
| تقليل الأخطاء | المطورون يرون الـ DTOs والاستجابات المتوقعة |
| تكامل مع الفرق | Frontend developers يفهمون الـ API بسهولة |
| معيار صناعي | OpenAPI spec يمكن تصديره لأدوات أخرى |

---

## 3.4 إضافة Redis Caching

### ما هي المشكلة؟

كل طلب API يذهب لقاعدة البيانات حتى لو البيانات لم تتغير:
- قائمة الأقسام لا تتغير كثيراً لكن تُجلب من DB كل مرة
- قائمة الصلاحيات ثابتة لكن تُستعلم في كل طلب
- أيام العطل لا تتغير لكن تُحسب في كل طلب إجازة
- ضغط غير ضروري على قاعدة البيانات

### آلية الإصلاح

**1. إضافة Redis في Docker:**

```yaml
# docker-compose.yml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis-data:/data
  command: redis-server --appendonly yes
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5

volumes:
  pgdata:
  redis-data:
```

**2. تثبيت الحزم:**

```bash
npm install @nestjs/cache-manager cache-manager cache-manager-redis-yet redis
```

**3. إعداد في AppModule:**

```typescript
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
          },
          ttl: 60 * 1000, // 60 ثانية افتراضي
        }),
      }),
    }),
    // ...
  ],
})
```

**4. استخدام في الخدمات:**

```typescript
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class DepartmentsService {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  async findAll() {
    // محاولة جلب من الكاش أولاً
    const cached = await this.cache.get<Department[]>('departments:all');
    if (cached) return cached;

    // جلب من قاعدة البيانات
    const departments = await this.prisma.department.findMany({
      where: { deletedAt: null },
      include: { children: true, manager: true },
    });

    // حفظ في الكاش لمدة 5 دقائق
    await this.cache.set('departments:all', departments, 300_000);

    return departments;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const result = await this.prisma.department.update({ where: { id }, data: dto });

    // إبطال الكاش عند التعديل
    await this.cache.del('departments:all');
    await this.cache.del(`departments:${id}`);

    return result;
  }
}
```

**5. ما يجب تخزينه مؤقتاً:**

| البيان | مدة التخزين | السبب |
|--------|------------|-------|
| الأقسام | 5 دقائق | نادراً ما تتغير |
| المسميات الوظيفية | 5 دقائق | نادراً ما تتغير |
| الدرجات الوظيفية | 5 دقائق | نادراً ما تتغير |
| أنواع الإجازات | 10 دقائق | شبه ثابتة |
| أيام العطل | 30 دقيقة | تتغير سنوياً فقط |
| قائمة الصلاحيات | 10 دقائق | نادراً ما تتغير |
| جداول العمل | 5 دقائق | تتغير موسمياً |

### الفوائد

| الفائدة | الشرح |
|---------|-------|
| أداء أسرع 10x-100x | القراءة من Redis بـ 0.1ms مقابل 5-50ms من PostgreSQL |
| تقليل حمل DB | طلبات أقل على قاعدة البيانات |
| قابلية التوسع | يمكن خدمة آلاف المستخدمين بدون ضغط |
| استجابة فورية | البيانات شبه الثابتة تُرجع فوراً |
| مشاركة بين الخدمات | Redis مشترك بين جميع الخدمات |

---

## 3.5 تطوير خدمة التقارير

### ما هي المشكلة؟

النظام يحتوي على بيانات غنية لكن لا يوجد تقارير:
- لا يوجد تقرير حضور شهري
- لا يوجد تقرير إجازات حسب القسم
- لا يوجد تقرير أداء مقارن
- لا يوجد لوحة معلومات (Dashboard) للإدارة
- لا يمكن تصدير البيانات

### آلية الإصلاح

**1. إنشاء وحدة تقارير مركزية في Gateway أو كخدمة مستقلة:**

```
apps/gateway/src/reports/ (أو خدمة مستقلة)
├── reports.controller.ts
├── reports.service.ts
├── reports.module.ts
├── generators/
│   ├── attendance-report.generator.ts
│   ├── leave-report.generator.ts
│   ├── evaluation-report.generator.ts
│   ├── payroll-report.generator.ts
│   └── employee-report.generator.ts
└── dto/
    ├── report-query.dto.ts
    └── report-response.dto.ts
```

**2. أنواع التقارير المطلوبة:**

```typescript
// التقارير المتاحة
enum ReportType {
  // تقارير الحضور
  ATTENDANCE_MONTHLY,          // تقرير حضور شهري
  ATTENDANCE_DEPARTMENT,       // حضور حسب القسم
  ATTENDANCE_LATE_SUMMARY,     // ملخص التأخيرات
  ATTENDANCE_ABSENCE_SUMMARY,  // ملخص الغياب

  // تقارير الإجازات
  LEAVE_BALANCE_SUMMARY,       // أرصدة الإجازات
  LEAVE_DEPARTMENT_USAGE,      // استخدام الإجازات حسب القسم
  LEAVE_TYPE_ANALYSIS,         // تحليل أنواع الإجازات

  // تقارير التقييم
  EVALUATION_SCORES,           // درجات التقييم
  EVALUATION_DEPARTMENT_AVG,   // متوسط الأداء حسب القسم
  EVALUATION_RECOMMENDATIONS,  // توصيات التقييم

  // تقارير الرواتب
  PAYROLL_MONTHLY,             // كشف رواتب شهري
  PAYROLL_DEDUCTIONS,          // تقرير الاستقطاعات
  PAYROLL_DEPARTMENT_COST,     // تكلفة الأقسام

  // تقارير الموظفين
  EMPLOYEE_HEADCOUNT,          // عدد الموظفين
  EMPLOYEE_TURNOVER,           // معدل الدوران
  EMPLOYEE_DEMOGRAPHICS,       // التوزيع الديموغرافي
}
```

**3. مثال: تقرير الحضور الشهري:**

```typescript
@Injectable()
export class AttendanceReportGenerator {

  async generateMonthlyReport(month: number, year: number, departmentId?: string) {
    // 1. جلب سجلات الحضور من خدمة الحضور
    const records = await this.fetchAttendanceRecords(month, year, departmentId);

    // 2. جلب قائمة الموظفين
    const employees = await this.fetchEmployees(departmentId);

    // 3. حساب الإحصائيات لكل موظف
    const employeeStats = employees.map(emp => {
      const empRecords = records.filter(r => r.employeeId === emp.id);

      return {
        employeeId: emp.id,
        employeeName: `${emp.firstNameAr} ${emp.lastNameAr}`,
        department: emp.department?.nameAr,
        workDays: this.countWorkDays(month, year),
        presentDays: empRecords.filter(r => r.status === 'PRESENT').length,
        absentDays: empRecords.filter(r => r.status === 'ABSENT').length,
        lateDays: empRecords.filter(r => r.status === 'LATE').length,
        earlyLeaveDays: empRecords.filter(r => r.status === 'EARLY_LEAVE').length,
        leaveDays: empRecords.filter(r => r.status === 'ON_LEAVE').length,
        totalLateMinutes: empRecords.reduce((sum, r) => sum + (r.lateMinutes || 0), 0),
        attendanceRate: (empRecords.filter(r => ['PRESENT', 'LATE'].includes(r.status)).length
                        / this.countWorkDays(month, year) * 100).toFixed(1) + '%',
      };
    });

    // 4. حساب الإحصائيات العامة
    return {
      report: {
        type: 'ATTENDANCE_MONTHLY',
        period: `${year}-${String(month).padStart(2, '0')}`,
        generatedAt: new Date().toISOString(),
        department: departmentId || 'ALL',
      },
      summary: {
        totalEmployees: employees.length,
        averageAttendanceRate: this.calcAverage(employeeStats, 'attendanceRate'),
        totalAbsentDays: employeeStats.reduce((sum, e) => sum + e.absentDays, 0),
        totalLateDays: employeeStats.reduce((sum, e) => sum + e.lateDays, 0),
      },
      details: employeeStats,
    };
  }
}
```

**4. نقاط API للتقارير:**

```typescript
@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {

  @Permission('reports:attendance:read')
  @Get('attendance/monthly')
  getMonthlyAttendance(
    @Query('month') month: number,
    @Query('year') year: number,
    @Query('departmentId') departmentId?: string,
  ) { /* ... */ }

  @Permission('reports:leave:read')
  @Get('leave/balance-summary')
  getLeaveBalanceSummary(
    @Query('year') year: number,
    @Query('departmentId') departmentId?: string,
  ) { /* ... */ }

  @Permission('reports:evaluation:read')
  @Get('evaluation/scores')
  getEvaluationScores(
    @Query('periodId') periodId: string,
    @Query('departmentId') departmentId?: string,
  ) { /* ... */ }

  @Permission('reports:export')
  @Get('export/:type')
  exportReport(
    @Param('type') type: string,
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    // تصدير كـ Excel أو PDF
  }
}
```

### الفوائد

| الفائدة | الشرح |
|---------|-------|
| رؤية شاملة | الإدارة تراقب أداء المنظمة بالأرقام |
| اتخاذ قرارات مبنية على بيانات | تقارير دقيقة للتحليل |
| الامتثال القانوني | تقارير مطلوبة لوزارة العمل |
| تتبع الأداء | مقارنة الأقسام والموظفين |
| التصدير | إمكانية مشاركة التقارير مع الإدارة العليا |

---

# ملخص شامل

## جدول المراحل والجهد المتوقع

| # | التعديل | الأولوية | التعقيد | الملفات المتأثرة |
|---|---------|----------|---------|-----------------|
| 1.1 | إصلاح CORS | فوري | منخفض | 2-3 ملفات |
| 1.2 | Rate Limiting | فوري | منخفض | 3-4 ملفات |
| 1.3 | Helmet Headers | فوري | منخفض | 1-2 ملف |
| 1.4 | إصلاح Refresh Token | فوري | متوسط | 1 ملف |
| 1.5 | إزالة JWT Defaults | فوري | منخفض | 6-8 ملفات |
| 2.1 | كتابة اختبارات | عالي | عالي | 20+ ملف جديد |
| 2.2 | Structured Logging | عالي | متوسط | 10-15 ملف |
| 2.3 | CI/CD Pipeline | عالي | متوسط | 1-3 ملفات |
| 2.4 | توحيد Shared Package | عالي | عالي | 30+ ملف |
| 2.5 | توحيد الصلاحيات | عالي | عالي | 20+ ملف + DB migration |
| 3.1 | نظام الرواتب | متوسط | عالي جداً | خدمة جديدة كاملة |
| 3.2 | نظام الإشعارات | متوسط | عالي | خدمة جديدة كاملة |
| 3.3 | Swagger UI | متوسط | متوسط | 15-20 ملف |
| 3.4 | Redis Caching | متوسط | متوسط | 10-15 ملف |
| 3.5 | خدمة التقارير | متوسط | عالي | وحدة/خدمة جديدة |

## ترتيب التنفيذ المقترح

```
الأسبوع 1-2:   المرحلة 1 (الأمان الفوري) → 1.1, 1.2, 1.3, 1.4, 1.5
الأسبوع 3-4:   توحيد الكود → 2.4 (shared package), 2.5 (permissions)
الأسبوع 5-6:   البنية التحتية → 2.2 (logging), 2.3 (CI/CD)
الأسبوع 7-10:  الاختبارات → 2.1 (tests)
الأسبوع 11-12: Swagger + Redis → 3.3, 3.4
الأسبوع 13-16: نظام الرواتب → 3.1
الأسبوع 17-18: نظام الإشعارات → 3.2
الأسبوع 19-20: خدمة التقارير → 3.5
```

---

> **ملاحظة:** هذا الملف مرجع تخطيطي. كل تعديل يحتاج مراجعة تفصيلية قبل التنفيذ الفعلي بناءً على متطلبات المشروع الحالية.
