# دليل النشر على السيرفر (Production Deployment Guide)

## المتطلبات الأساسية

- Ubuntu 20.04 LTS أو أحدث
- Docker 20.10 أو أحدث
- Docker Compose 2.0 أو أحدث
- Git
- 4GB RAM كحد أدنى (8GB موصى به)
- 20GB مساحة تخزين

---

## خطوات النشر

### 1. تثبيت المتطلبات على السيرفر

```bash
# تحديث النظام
sudo apt update && sudo apt upgrade -y

# تثبيت Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# تثبيت Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# تثبيت Git
sudo apt install git -y

# إعادة تسجيل الدخول لتفعيل Docker group
logout
```

---

### 2. نقل المشروع إلى السيرفر

**الطريقة 1: استخدام Git (موصى به)**

```bash
# على السيرفر
cd /opt
sudo mkdir -p myapiplatform
sudo chown $USER:$USER myapiplatform
cd myapiplatform

# رفع المشروع إلى GitHub/GitLab أولاً من جهازك المحلي
git clone https://github.com/your-username/my-api-platform.git .
```

**الطريقة 2: استخدام rsync**

```bash
# من جهازك المحلي
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude 'coverage' \
  c:/Users/user/Desktop/wso/my-api-platform/ \
  user@your-server-ip:/opt/myapiplatform/
```

**الطريقة 3: استخدام scp**

```bash
# من جهازك المحلي
cd c:/Users/user/Desktop/wso
tar -czf my-api-platform.tar.gz my-api-platform/ \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist'

scp my-api-platform.tar.gz user@your-server-ip:/opt/

# على السيرفر
cd /opt
tar -xzf my-api-platform.tar.gz
mv my-api-platform myapiplatform
```

---

### 3. إعداد ملف البيئة (Environment Variables)

```bash
cd /opt/myapiplatform

# نسخ ملف المثال
cp .env.production.example .env.production

# تعديل الملف بمحرر nano أو vim
nano .env.production
```

**قم بتغيير القيم التالية:**

```env
DB_USER=postgres
DB_PASSWORD=YOUR_VERY_STRONG_PASSWORD_HERE
DB_NAME=platform

JWT_ACCESS_SECRET=YOUR_ACCESS_SECRET_32_CHARS_MINIMUM
JWT_REFRESH_SECRET=YOUR_REFRESH_SECRET_32_CHARS_MINIMUM

ACCESS_TOKEN_TTL=900
REFRESH_TOKEN_TTL=30
```

**لتوليد أسرار عشوائية قوية:**

```bash
# توليد سر عشوائي
openssl rand -base64 32

# أو
cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1
```

---

### 4. إعداد قاعدة البيانات

```bash
cd /opt/myapiplatform

# بناء وتشغيل PostgreSQL فقط أولاً
docker-compose -f docker-compose.prod.yml up -d postgres

# الانتظار حتى تصبح قاعدة البيانات جاهزة
docker logs -f myapiplatform-postgres
# انتظر حتى ترى: "database system is ready to accept connections"
# اضغط Ctrl+C للخروج
```

---

### 5. تشغيل Migrations

```bash
# Auth Service Migration
docker-compose -f docker-compose.prod.yml run --rm auth npx prisma migrate deploy

# Users Service Migration
docker-compose -f docker-compose.prod.yml run --rm users npx prisma migrate deploy

# Leave Service Migration
docker-compose -f docker-compose.prod.yml run --rm leave npx prisma migrate deploy

# Attendance Service Migration
docker-compose -f docker-compose.prod.yml run --rm attendance npx prisma migrate deploy

# Evaluation Service Migration
docker-compose -f docker-compose.prod.yml run --rm evaluation npx prisma migrate deploy
```

---

### 6. تشغيل Seeds (البيانات الأولية)

```bash
# Users Service Seed (يجب تشغيله أولاً)
docker-compose -f docker-compose.prod.yml run --rm users npm run prisma:seed

# Leave Service Seed
docker-compose -f docker-compose.prod.yml run --rm leave npm run prisma:seed

# Attendance Service Seed
docker-compose -f docker-compose.prod.yml run --rm attendance npm run prisma:seed

# Evaluation Service Seed
docker-compose -f docker-compose.prod.yml run --rm evaluation npm run prisma:seed
```

---

### 7. بناء وتشغيل جميع الخدمات

```bash
cd /opt/myapiplatform

# بناء جميع الصور
docker-compose -f docker-compose.prod.yml build

# تشغيل جميع الخدمات
docker-compose -f docker-compose.prod.yml up -d

# التحقق من حالة الخدمات
docker-compose -f docker-compose.prod.yml ps
```

---

### 8. التحقق من عمل الخدمات

```bash
# التحقق من logs
docker-compose -f docker-compose.prod.yml logs -f

# التحقق من خدمة معينة
docker logs -f myapiplatform-gateway
docker logs -f myapiplatform-auth
docker logs -f myapiplatform-users

# اختبار الـ Gateway
curl http://localhost:8000/health
```

---

### 9. إعداد Nginx Reverse Proxy (اختياري لكن موصى به)

```bash
# تثبيت Nginx
sudo apt install nginx -y

# إنشاء ملف الإعداد
sudo nano /etc/nginx/sites-available/myapiplatform
```

**محتوى الملف:**

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**تفعيل الإعداد:**

```bash
# إنشاء رابط رمزي
sudo ln -s /etc/nginx/sites-available/myapiplatform /etc/nginx/sites-enabled/

# اختبار الإعداد
sudo nginx -t

# إعادة تحميل Nginx
sudo systemctl reload nginx
```

---

### 10. إعداد SSL باستخدام Let's Encrypt (موصى به بشدة)

```bash
# تثبيت Certbot
sudo apt install certbot python3-certbot-nginx -y

# الحصول على شهادة SSL
sudo certbot --nginx -d api.yourdomain.com

# اختبار التجديد التلقائي
sudo certbot renew --dry-run
```

---

### 11. إعداد Firewall

```bash
# تفعيل UFW
sudo ufw enable

# السماح بـ SSH
sudo ufw allow 22/tcp

# السماح بـ HTTP و HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# التحقق من الحالة
sudo ufw status
```

---

### 12. اختبار النظام

```bash
# تسجيل الدخول
curl -X POST http://your-server-ip:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password123"
  }'

# أو إذا كنت استخدمت Nginx مع domain
curl -X POST https://api.yourdomain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password123"
  }'
```

**يجب أن ترى:**
```json
{
  "success": true,
  "data": {
    "user": {...},
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

---

## أوامر مفيدة للصيانة

### عرض حالة الخدمات
```bash
docker-compose -f docker-compose.prod.yml ps
```

### إيقاف جميع الخدمات
```bash
docker-compose -f docker-compose.prod.yml down
```

### إيقاف خدمة واحدة
```bash
docker-compose -f docker-compose.prod.yml stop gateway
```

### بدء خدمة واحدة
```bash
docker-compose -f docker-compose.prod.yml start gateway
```

### إعادة بناء خدمة بعد تحديث الكود
```bash
docker-compose -f docker-compose.prod.yml build --no-cache gateway
docker-compose -f docker-compose.prod.yml up -d gateway
```

### عرض logs لخدمة معينة
```bash
docker-compose -f docker-compose.prod.yml logs -f gateway
```

### عرض استهلاك الموارد
```bash
docker stats
```

### تنظيف Docker (تحرير مساحة)
```bash
# حذف الصور غير المستخدمة
docker image prune -a

# حذف الـ containers المتوقفة
docker container prune

# حذف الـ volumes غير المستخدمة (احذر!)
docker volume prune
```

---

## Backup قاعدة البيانات

### إنشاء Backup يدوي
```bash
# Backup كامل
docker exec myapiplatform-postgres pg_dumpall -U postgres > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup لقاعدة بيانات واحدة
docker exec myapiplatform-postgres pg_dump -U postgres platform > platform_backup_$(date +%Y%m%d_%H%M%S).sql
```

### استعادة Backup
```bash
# استعادة من backup
docker exec -i myapiplatform-postgres psql -U postgres < backup_file.sql
```

### Backup تلقائي (Cron Job)
```bash
# تعديل crontab
crontab -e

# إضافة السطر التالي (backup يومي الساعة 2 صباحاً)
0 2 * * * docker exec myapiplatform-postgres pg_dumpall -U postgres > /opt/backups/db_backup_$(date +\%Y\%m\%d).sql
```

---

## تحديث النظام (Updates)

### تحديث الكود من Git
```bash
cd /opt/myapiplatform

# سحب أحدث تحديثات
git pull origin main

# إعادة بناء الخدمات
docker-compose -f docker-compose.prod.yml build

# تشغيل migrations إن وجدت
docker-compose -f docker-compose.prod.yml run --rm users npx prisma migrate deploy

# إعادة تشغيل الخدمات
docker-compose -f docker-compose.prod.yml up -d
```

---

## Monitoring وال Logs

### مراقبة Logs في الوقت الفعلي
```bash
# جميع الخدمات
docker-compose -f docker-compose.prod.yml logs -f

# خدمة واحدة
docker logs -f myapiplatform-gateway

# آخر 100 سطر
docker logs --tail 100 myapiplatform-gateway
```

### مراقبة استهلاك الموارد
```bash
# عرض استهلاك CPU و Memory
docker stats

# عرض مساحة القرص
df -h
docker system df
```

---

## حل المشاكل الشائعة

### الخدمة لا تبدأ
```bash
# التحقق من الـ logs
docker logs myapiplatform-gateway

# التحقق من حالة الخدمة
docker-compose -f docker-compose.prod.yml ps

# إعادة بناء الخدمة
docker-compose -f docker-compose.prod.yml build --no-cache gateway
docker-compose -f docker-compose.prod.yml up -d gateway
```

### قاعدة البيانات لا تستجيب
```bash
# التحقق من حالة PostgreSQL
docker logs myapiplatform-postgres

# إعادة تشغيل PostgreSQL
docker-compose -f docker-compose.prod.yml restart postgres

# الدخول إلى PostgreSQL
docker exec -it myapiplatform-postgres psql -U postgres
```

### نفاد المساحة
```bash
# التحقق من المساحة
df -h

# تنظيف Docker
docker system prune -a --volumes

# حذف logs قديمة
sudo truncate -s 0 /var/lib/docker/containers/*/*-json.log
```

### بطء في الأداء
```bash
# التحقق من استهلاك الموارد
docker stats

# التحقق من الـ connections
docker exec myapiplatform-postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# إعادة تشغيل الخدمات
docker-compose -f docker-compose.prod.yml restart
```

---

## الأمان (Security Checklist)

- [ ] تغيير جميع كلمات المرور الافتراضية
- [ ] استخدام أسرار JWT قوية (32 حرف على الأقل)
- [ ] تفعيل SSL/HTTPS
- [ ] إعداد Firewall (UFW)
- [ ] إغلاق جميع البورتات غير الضرورية
- [ ] عمل backup دوري لقاعدة البيانات
- [ ] مراقبة logs بشكل دوري
- [ ] تحديث النظام والـ packages بانتظام
- [ ] استخدام non-root user لتشغيل الخدمات
- [ ] تفعيل rate limiting في Nginx

---

## معلومات الاتصال

**البورتات:**
- Gateway: 8000 (أو 80/443 عبر Nginx)
- Auth Service: 4001 (داخلي فقط)
- Users Service: 4002 (داخلي فقط)
- Leave Service: 4003 (داخلي فقط)
- Attendance Service: 4004 (داخلي فقط)
- Evaluation Service: 4005 (داخلي فقط)
- PostgreSQL: 5432 (داخلي فقط)

**المستخدم الافتراضي:**
- Username: `admin`
- Password: `password123` (يجب تغييره فوراً!)

---

## الخطوات التالية

1. تغيير كلمة مرور admin من واجهة المستخدم
2. إنشاء مستخدمين وأدوار جديدة
3. إعداد الأقسام والموظفين
4. إعداد أنواع الإجازات وجداول العمل
5. إعداد فترات ومعايير التقييم

---

**آخر تحديث**: 2026-01-25
