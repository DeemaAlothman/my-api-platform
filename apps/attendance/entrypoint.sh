#!/bin/sh
set -e

npx prisma migrate resolve --applied "20260121160000_init_attendance"      || true
npx prisma migrate resolve --applied "20260406000002_attendance_additions" || true
npx prisma migrate resolve --applied "20260407000001_payroll_financial_fields" || true
npx prisma migrate resolve --applied "20260413000001_payroll_bonus_penalty_fields" || true

npx prisma migrate deploy

exec node dist/src/main.js
