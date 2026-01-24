# ✅ Attendance Service Deployment Checklist

استخدم هذا الـ Checklist للتأكد من أنك نفذت جميع الخطوات بشكل صحيح.

---

## 📦 قبل الرفع (على جهازك المحلي)

### ملفات رئيسية:
- [ ] `apps/attendance/` موجود وكامل
- [ ] `apps/attendance/Dockerfile` موجود
- [ ] `apps/attendance/prisma/schema.prisma` موجود
- [ ] `apps/attendance/prisma/seed.ts` موجود
- [ ] `apps/attendance/prisma/migrations/` موجود

### ملفات معدلة:
- [ ] `apps/auth/src/auth/auth.service.ts` يحتوي على 17 attendance permission
- [ ] `apps/users/prisma/seed.ts` يحتوي على 22 attendance permission
- [ ] `apps/gateway/src/proxy/proxy.controller.ts` يحتوي على 3 controllers جديدة
- [ ] `apps/gateway/src/proxy/proxy.service.ts` يحتوي على attendance service URL
- [ ] `apps/gateway/src/proxy/proxy.module.ts` يستورد الـ controllers الجديدة
- [ ] `docker-compose.prod.yml` يحتوي على attendance service

### تحقق من Permissions في Auth Service:
```bash
grep -n "attendance.work-schedules" apps/auth/src/auth/auth.service.ts
```
- [ ] يظهر على الأقل 17 سطر فيها attendance permissions

---

## 🔐 Git & Push

- [ ] `git add apps/attendance/`
- [ ] `git add apps/auth/src/auth/auth.service.ts`
- [ ] `git add apps/users/prisma/seed.ts`
- [ ] `git add apps/gateway/src/proxy/*`
- [ ] `git add docker-compose.prod.yml`
- [ ] `git commit` مع رسالة واضحة
- [ ] `git push origin main` نجح بدون أخطاء

---

## 🖥️ على السيرفر

### اتصال وتحديث:
- [ ] `ssh` للسيرفر نجح
- [ ] `cd` لمجلد المشروع
- [ ] `git pull origin main` نجح
- [ ] التحقق من وصول ملفات attendance

### بناء وتشغيل:
- [ ] `docker-compose -f docker-compose.prod.yml down`
- [ ] `docker-compose -f docker-compose.prod.yml build` (انتظر 10-15 دقيقة)
- [ ] `docker-compose -f docker-compose.prod.yml up -d`
- [ ] `docker-compose -f docker-compose.prod.yml ps` يظهر جميع الخدمات "Up"

### قاعدة البيانات:
- [ ] Migration: `docker exec -it myapiplatform-attendance npx prisma migrate deploy`
- [ ] Seed Attendance: `docker exec -it myapiplatform-attendance npm run seed`
- [ ] Seed Users: `docker exec -it myapiplatform-users npm run seed`
- [ ] إعادة تشغيل Auth: `docker-compose -f docker-compose.prod.yml restart auth`

---

## 🧪 الاختبار

### Health Check:
- [ ] `curl http://SERVER_IP:5000/api/v1/auth/health` يعطي "ok"

### Login & Permissions:
- [ ] Login يعطي token
- [ ] Response يحتوي على ~57 permission
- [ ] يوجد على الأقل 17 permission تبدأ بـ "attendance."

### Endpoints:
- [ ] `GET /work-schedules` يعطي 3 schedules
- [ ] `POST /attendance-records/clock-in` يعمل
- [ ] `GET /attendance-records/my` يعطي السجلات

### Logs:
- [ ] `docker logs myapiplatform-attendance` بدون errors
- [ ] `docker logs myapiplatform-auth` بدون errors
- [ ] `docker logs myapiplatform-gateway` بدون errors

---

## ⚠️ استكشاف الأخطاء

إذا فشل أي اختبار:

### Permissions = 40 فقط (بدل 57):
```bash
# تأكد من أن Auth تم تحديثه
docker exec myapiplatform-auth cat /app/dist/auth/auth.service.js | grep attendance

# إذا لم يظهر شيء، أعد البناء
docker-compose -f docker-compose.prod.yml build auth
docker-compose -f docker-compose.prod.yml up -d auth
```

### Attendance Service لا يعمل:
```bash
# شاهد الـ logs
docker logs myapiplatform-attendance --tail 50

# أعد البناء
docker-compose -f docker-compose.prod.yml build attendance
docker-compose -f docker-compose.prod.yml up -d attendance
```

### Gateway لا يوجه الطلبات:
```bash
# تحقق من environment variable
docker exec myapiplatform-gateway env | grep ATTENDANCE_SERVICE_URL

# أعد البناء إذا لم يظهر
docker-compose -f docker-compose.prod.yml build gateway
docker-compose -f docker-compose.prod.yml up -d gateway
```

---

## ✅ النتيجة النهائية

عند إكمال جميع الخطوات:

- [x] **6 خدمات** تعمل (postgres, auth, users, leave, attendance, gateway)
- [x] **57 permission** في Login response (40 + 17)
- [x] **3 work schedules** في قاعدة البيانات
- [x] **جميع endpoints** تعمل بدون أخطاء
- [x] **لا توجد errors** في Logs

---

**🎉 تهانينا! Attendance Service جاهز للاستخدام!**
