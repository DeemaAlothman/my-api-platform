#!/bin/sh
set -e

npx prisma migrate resolve --applied "20260124000000_init_evaluation" || true
npx prisma migrate resolve --applied "20260406000002_evaluation_probation" || true

npx prisma migrate deploy

exec node dist/src/main.js
