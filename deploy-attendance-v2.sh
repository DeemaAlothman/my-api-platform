#!/bin/bash

# =================================================================
# Deploy Script: Attendance V2 (Employee Schedules + Justifications)
# Server: 217.76.53.136
# Project: /root/my-api-platform
# SAFE: Does NOT delete any existing data
# =================================================================

set -e

SERVER_IP="217.76.53.136"
SERVER_USER="root"
PROJECT_DIR="/root/my-api-platform"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Attendance V2 - Production Deploy   ${NC}"
echo -e "${GREEN}======================================${NC}"

# =================================================================
# Step 1: Pull latest code
# =================================================================
echo -e "\n${YELLOW}[1/7] Pulling latest code from git...${NC}"
ssh ${SERVER_USER}@${SERVER_IP} "cd ${PROJECT_DIR} && git pull origin main"

# =================================================================
# Step 2: Push Attendance Schema (adds new tables, safe for existing data)
# Uses existing attendance container (has correct DATABASE_URL already)
# =================================================================
echo -e "\n${YELLOW}[2/7] Pushing attendance schema changes to DB...${NC}"
echo -e "      (Adds: AttendanceJustification table, deductionApplied/deductionMinutes fields)"
ssh ${SERVER_USER}@${SERVER_IP} "
  # Copy updated schema into running container
  docker cp ${PROJECT_DIR}/apps/attendance/prisma/schema.prisma myapiplatform-attendance:/app/prisma/schema.prisma

  # Run prisma db push inside container (uses container's own DATABASE_URL env)
  docker exec myapiplatform-attendance sh -c 'cd /app && npx prisma db push'

  echo 'Schema push complete'
"

# =================================================================
# Step 3: Add new permissions to DB (safe, uses ON CONFLICT DO NOTHING)
# =================================================================
echo -e "\n${YELLOW}[3/7] Adding new permissions to database...${NC}"
echo -e "      (employee-schedules + justifications permissions)"
scp migrations/add-attendance-v2-permissions.sql ${SERVER_USER}@${SERVER_IP}:/tmp/
ssh ${SERVER_USER}@${SERVER_IP} "
  docker exec myapiplatform-postgres psql -U postgres -d platform -f /tmp/add-attendance-v2-permissions.sql
  rm /tmp/add-attendance-v2-permissions.sql
"

# =================================================================
# Step 4: Rebuild attendance service
# =================================================================
echo -e "\n${YELLOW}[4/7] Rebuilding attendance service...${NC}"
ssh ${SERVER_USER}@${SERVER_IP} "
  cd ${PROJECT_DIR}
  docker-compose stop attendance
  docker-compose build attendance
  docker-compose up -d attendance
"

# =================================================================
# Step 5: Rebuild gateway service
# =================================================================
echo -e "\n${YELLOW}[5/7] Rebuilding gateway service...${NC}"
ssh ${SERVER_USER}@${SERVER_IP} "
  cd ${PROJECT_DIR}
  docker-compose stop gateway
  docker-compose build gateway
  docker-compose up -d gateway
"

# =================================================================
# Step 6: Rebuild auth service
# =================================================================
echo -e "\n${YELLOW}[6/7] Rebuilding auth service...${NC}"
ssh ${SERVER_USER}@${SERVER_IP} "
  cd ${PROJECT_DIR}
  docker-compose stop auth
  docker-compose build auth
  docker-compose up -d auth
"

# =================================================================
# Step 7: Verify all services are running
# =================================================================
echo -e "\n${YELLOW}[7/7] Verifying services...${NC}"
sleep 10
ssh ${SERVER_USER}@${SERVER_IP} "
  echo '--- Container Status ---'
  docker ps --format 'table {{.Names}}\t{{.Status}}' | grep myapiplatform
  echo ''
  echo '--- Attendance Routes Check ---'
  docker logs myapiplatform-attendance --tail 5 2>&1 | grep -E 'justification|schedule|started' | tail -5
  echo ''
  echo '--- Gateway Routes Check ---'
  docker logs myapiplatform-gateway --tail 5 2>&1 | grep -E 'justification|schedule|started' | tail -5
"

echo -e "\n${GREEN}======================================${NC}"
echo -e "${GREEN}  Deployment completed successfully!  ${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "New endpoints available:"
echo "  POST   /api/v1/attendance-justifications"
echo "  GET    /api/v1/attendance-justifications"
echo "  GET    /api/v1/attendance-justifications/my"
echo "  GET    /api/v1/attendance-justifications/:id"
echo "  PATCH  /api/v1/attendance-justifications/:id/manager-review"
echo "  PATCH  /api/v1/attendance-justifications/:id/hr-review"
echo "  POST   /api/v1/attendance-justifications/process-expired"
echo "  GET    /api/v1/employee-schedules"
echo "  POST   /api/v1/employee-schedules"
echo "  PATCH  /api/v1/employee-schedules/:id"
echo "  DELETE /api/v1/employee-schedules/:id"
