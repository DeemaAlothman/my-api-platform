#!/bin/sh
set -e

npx prisma migrate deploy

exec node dist/apps/warehouse/src/main.js
