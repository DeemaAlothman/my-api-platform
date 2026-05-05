/**
 * generate-seeds.ts
 * يقرأ backup SQL ويولّد seed files تنفّذ SQL مباشرة — بيانات مطابقة 100%
 * الاستخدام: npx tsx scripts/generate-seeds.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SQL_FILE = path.join(__dirname, 'backup_20260505.sql');
const ROOT = path.join(__dirname, '..');

// ===== Parser: يستخرج COPY block ويحوّله لـ INSERT SQL =====

function extractInsertSql(sql: string, table: string): string {
  // escape للاستخدام في regex
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `COPY ${escaped} \\(([^)]+)\\) FROM stdin;\\n([\\s\\S]*?)^\\\\.`,
    'm',
  );
  const match = regex.exec(sql);
  if (!match || !match[2].trim()) return '';

  const columns = match[1].trim();
  const rawRows = match[2].trim().split('\n').filter(Boolean);

  const valueRows = rawRows.map((row) => {
    const fields = row.split('\t');
    const vals = fields.map((v) => {
      if (v === '\\N') return 'NULL';
      if (v === 't') return 'TRUE';
      if (v === 'f') return 'FALSE';
      // number
      if (/^-?\d+(\.\d+)?$/.test(v)) return v;
      // string — escape single quotes
      return `'${v.replace(/'/g, "''")}'`;
    });
    return `  (${vals.join(', ')})`;
  });

  return (
    `INSERT INTO ${table} (${columns})\nVALUES\n` +
    valueRows.join(',\n') +
    `\nON CONFLICT DO NOTHING;`
  );
}

function buildSeedFile(
  serviceName: string,
  tableInserts: { label: string; sql: string }[],
): string {
  const blocks = tableInserts
    .filter((t) => t.sql)
    .map(
      (t) =>
        `  // ${t.label}\n  await prisma.$executeRawUnsafe(\`\n${t.sql}\n  \`);`,
    )
    .join('\n\n');

  return `import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding ${serviceName}...');

${blocks}

  console.log('${serviceName} seeding done.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
`;
}

// ===== Read SQL =====
console.log('Reading SQL...');
const sql = fs.readFileSync(SQL_FILE, 'utf8');
console.log(`Size: ${(sql.length / 1024 / 1024).toFixed(1)} MB\n`);

// ===== users seed =====
const usersTables = [
  { label: 'job_grades', table: 'users.job_grades' },
  { label: 'departments', table: 'users.departments' },
  { label: 'job_titles', table: 'users.job_titles' },
  { label: 'permissions', table: 'users.permissions' },
  { label: 'roles', table: 'users.roles' },
  { label: 'users', table: 'users.users' },
  { label: 'employees', table: 'users.employees' },
  { label: 'role_permissions', table: 'users.role_permissions' },
  { label: 'user_roles', table: 'users.user_roles' },
  { label: 'employee_allowances', table: 'users.employee_allowances' },
];

// ===== attendance seed =====
const attendanceTables = [
  { label: 'work_schedules', table: 'attendance.work_schedules' },
  { label: 'deduction_policies', table: 'attendance.deduction_policies' },
  { label: 'attendance_settings', table: 'attendance.attendance_settings' },
  { label: 'employee_schedules', table: 'attendance.employee_schedules' },
];

// ===== leave seed =====
const leaveTables = [
  { label: 'leave_types', table: 'leaves.leave_types' },
  { label: 'holidays', table: 'leaves.holidays' },
  { label: 'leave_balances', table: 'leaves.leave_balances' },
];

// ===== evaluation seed =====
const evaluationTables = [
  { label: 'ProbationCriteria', table: 'evaluation."ProbationCriteria"' },
  { label: 'EvaluationCriteria', table: 'evaluation."EvaluationCriteria"' },
  { label: 'EvaluationPeriod', table: 'evaluation."EvaluationPeriod"' },
];

// ===== Generate =====
const seeds = [
  {
    path: 'apps/users/prisma/seed.ts',
    name: 'users',
    tables: usersTables,
  },
  {
    path: 'apps/attendance/prisma/seed.ts',
    name: 'attendance',
    tables: attendanceTables,
  },
  {
    path: 'apps/leave/prisma/seed.ts',
    name: 'leave',
    tables: leaveTables,
  },
  {
    path: 'apps/evaluation/prisma/seed.ts',
    name: 'evaluation',
    tables: evaluationTables,
  },
];

for (const seed of seeds) {
  const tableInserts = seed.tables.map((t) => ({
    label: t.label,
    sql: extractInsertSql(sql, t.table),
  }));

  const counts = tableInserts.map(
    (t) =>
      `  ${t.label}: ${t.sql ? t.sql.split('\n').filter((l) => l.startsWith('  (')).length : 0} rows`,
  );
  console.log(`${seed.name}:\n${counts.join('\n')}`);

  const content = buildSeedFile(seed.name, tableInserts);
  fs.writeFileSync(path.join(ROOT, seed.path), content, 'utf8');
  console.log(`  → Written: ${seed.path}\n`);
}

console.log('All seed files generated.');
