#!/bin/sh
set -e

# Baseline existing migrations (mark as applied without running them)
npx prisma migrate resolve --applied "20260406000001_init_jobs"
npx prisma migrate resolve --applied "20260407000002_candidate_pipeline"
npx prisma migrate resolve --applied "20260411000001_seed_interview_criteria"
npx prisma migrate resolve --applied "20260411000002_add_position_requires_flags"

# Run only new/pending migrations
npx prisma migrate deploy

exec node dist/src/main.js
