#!/bin/bash

# 🚀 Quick Server Testing Script for Attendance Service
# يستخدم بعد رفع الخدمة على السيرفر للاختبار السريع

# ⚙️ Configuration
SERVER_IP="YOUR_SERVER_IP_HERE"  # غيّر هذا لـ IP السيرفر
BASE_URL="http://${SERVER_IP}:5000/api/v1"

echo "🔍 Testing Attendance Service on ${BASE_URL}"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "${YELLOW}[1/6] Testing Health Check...${NC}"
HEALTH=$(curl -s "${BASE_URL}/auth/health")
if echo "$HEALTH" | grep -q "ok"; then
  echo -e "${GREEN}✅ Health Check: OK${NC}"
else
  echo -e "${RED}❌ Health Check: FAILED${NC}"
  exit 1
fi
echo ""

# Test 2: Login and get token
echo -e "${YELLOW}[2/6] Testing Login...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login: FAILED (No token received)${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Login: OK${NC}"
echo "Token: ${TOKEN:0:30}..."

# Count permissions
PERM_COUNT=$(echo "$LOGIN_RESPONSE" | grep -o '"permissions":\[' | wc -l)
ATTENDANCE_PERMS=$(echo "$LOGIN_RESPONSE" | grep -o 'attendance\.' | wc -l)

echo "Total permissions found: ~${ATTENDANCE_PERMS} attendance permissions"
echo ""

# Test 3: Check Permissions
echo -e "${YELLOW}[3/6] Checking Attendance Permissions...${NC}"
if [ "$ATTENDANCE_PERMS" -gt 10 ]; then
  echo -e "${GREEN}✅ Permissions: OK (Found ${ATTENDANCE_PERMS} attendance permissions)${NC}"
else
  echo -e "${RED}❌ Permissions: WARNING (Found only ${ATTENDANCE_PERMS} attendance permissions)${NC}"
  echo -e "${YELLOW}Expected at least 17 attendance permissions${NC}"
  echo ""
  echo "Check if you restarted Auth Service after deployment:"
  echo "  docker-compose -f docker-compose.prod.yml restart auth"
fi
echo ""

# Test 4: Get Work Schedules
echo -e "${YELLOW}[4/6] Testing GET /work-schedules...${NC}"
SCHEDULES=$(curl -s "${BASE_URL}/work-schedules" \
  -H "Authorization: Bearer $TOKEN")

if echo "$SCHEDULES" | grep -q '"success":true'; then
  SCHEDULE_COUNT=$(echo "$SCHEDULES" | grep -o '"id":"' | wc -l)
  echo -e "${GREEN}✅ Work Schedules: OK (Found ${SCHEDULE_COUNT} schedules)${NC}"
else
  echo -e "${RED}❌ Work Schedules: FAILED${NC}"
  echo "Response: $SCHEDULES"
fi
echo ""

# Test 5: Clock In
echo -e "${YELLOW}[5/6] Testing POST /attendance-records/clock-in...${NC}"
CHECKIN=$(curl -s -X POST "${BASE_URL}/attendance-records/clock-in" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"location":"Test Location - Server Deployment"}')

if echo "$CHECKIN" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ Clock In: OK${NC}"
elif echo "$CHECKIN" | grep -q "ALREADY_CHECKED_IN"; then
  echo -e "${GREEN}✅ Clock In: OK (Already checked in today)${NC}"
else
  echo -e "${RED}❌ Clock In: FAILED${NC}"
  echo "Response: $CHECKIN"
fi
echo ""

# Test 6: Get My Attendance
echo -e "${YELLOW}[6/6] Testing GET /attendance-records/my...${NC}"
MY_ATTENDANCE=$(curl -s "${BASE_URL}/attendance-records/my" \
  -H "Authorization: Bearer $TOKEN")

if echo "$MY_ATTENDANCE" | grep -q '"success":true'; then
  RECORD_COUNT=$(echo "$MY_ATTENDANCE" | grep -o '"id":"' | wc -l)
  echo -e "${GREEN}✅ My Attendance: OK (Found ${RECORD_COUNT} records)${NC}"
else
  echo -e "${RED}❌ My Attendance: FAILED${NC}"
  echo "Response: $MY_ATTENDANCE"
fi
echo ""

# Final Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 Testing Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "If all tests passed, your Attendance Service is working correctly!"
echo ""
echo "Next steps:"
echo "  - Import Postman collection for detailed testing"
echo "  - Check logs: docker logs myapiplatform-attendance"
echo "  - Monitor: docker-compose -f docker-compose.prod.yml ps"
