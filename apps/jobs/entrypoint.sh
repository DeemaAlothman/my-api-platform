#!/bin/sh
set -e

# Baseline existing migrations (ignore if already applied)
npx prisma migrate resolve --applied "20260406000001_init_jobs" || true
npx prisma migrate resolve --applied "20260407000002_candidate_pipeline" || true
npx prisma migrate resolve --applied "20260411000001_seed_interview_criteria" || true
npx prisma migrate resolve --applied "20260411000002_add_position_requires_flags" || true

# Run only new/pending migrations
npx prisma migrate deploy

exec node dist/src/main.js
