/**
 * seed-local.ts
 * يستورد البيانات الحقيقية من backup_20260505.sql إلى قاعدة البيانات المحلية
 *
 * الاستخدام:
 *   npx tsx scripts/seed-local.ts
 *
 * المتطلبات:
 *   - ضع backup_20260505.sql في مجلد scripts/
 *   - تأكد أن قاعدة البيانات المحلية شغالة (docker compose up -d postgres)
 *   - DATABASE_URL في .env أو عبر متغير البيئة
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const SQL_FILE = path.join(__dirname, 'backup_20260505.sql');

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/platform';

async function run() {
  if (!fs.existsSync(SQL_FILE)) {
    console.error(`\nالملف غير موجود: ${SQL_FILE}`);
    console.error('ضع backup_20260505.sql داخل مجلد scripts/\n');
    process.exit(1);
  }

  console.log('قراءة ملف SQL...');
  const sql = fs.readFileSync(SQL_FILE, 'utf8');

  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('متصل بقاعدة البيانات...');

    console.log('تنفيذ SQL — قد يأخذ بضع ثوانٍ...');
    await client.query(sql);

    console.log('\nتم استيراد البيانات بنجاح!');
  } catch (err: any) {
    console.error('\nخطأ:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
