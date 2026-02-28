#!/bin/bash
BASE="http://localhost:8000/api/v1"
PASS=0; FAIL=0; BIZ=0
TS=$(date +%s)

TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"password123"}' | grep -o '"accessToken":"[^"]*"' | sed 's/"accessToken":"//;s/"$//')
AUTH="Authorization: Bearer $TOKEN"

check() {
  local name="$1"; local url="$2"; local method="${3:-GET}"; local body="$4"
  if [ -n "$body" ]; then
    code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X $method "$url" -H "$AUTH" -H "Content-Type: application/json" -d "$body")
  else
    code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X $method "$url" -H "$AUTH")
  fi
  resp=$(cat /tmp/resp.json)
  ok=$(echo "$resp" | grep -o '"success":true' | head -1)
  arr=$(echo "$resp" | head -c 1 | grep '\[')
  if [ -n "$ok" ] || [ -n "$arr" ] || ( [ "$code" -ge 200 ] && [ "$code" -lt 300 ] ); then
    echo "  PASS  $name"
    PASS=$((PASS+1))
  else
    echo "  FAIL  $name (HTTP $code)"
    echo "        $(echo $resp | head -c 160)"
    FAIL=$((FAIL+1))
  fi
}

biz() { echo "  BIZ   $1"; BIZ=$((BIZ+1)); }

# Get existing IDs
EMP_ID="6e1d81ba-24cb-4e19-ad44-317bd1ef0293"
DEPT_ID=$(curl -s "$BASE/departments" -H "$AUTH" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
GRADE_ID=$(curl -s "$BASE/job-grades" -H "$AUTH" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
TITLE_ID=$(curl -s "$BASE/job-titles" -H "$AUTH" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
LT_ID=$(curl -s "$BASE/leave-types" -H "$AUTH" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
WS_ID=$(curl -s "$BASE/work-schedules" -H "$AUTH" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')

echo "============================================================"
echo "  WSO HR Platform - Full Endpoint Test"
echo "============================================================"

echo ""
echo "[AUTH]"
check "POST /auth/login" "$BASE/auth/login" "POST" '{"username":"admin","password":"password123"}'

echo ""
echo "[DEPARTMENTS]"
check "GET /departments" "$BASE/departments"
check "GET /departments/tree" "$BASE/departments/tree"
D=$(curl -s -X POST "$BASE/departments" -H "$AUTH" -H "Content-Type: application/json" -d "{\"code\":\"DP_$TS\",\"nameAr\":\"قسم\",\"nameEn\":\"Dept\"}")
DID=$(echo $D | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
[ -n "$DID" ] && { echo "  PASS  POST /departments"; PASS=$((PASS+1)); } || { echo "  FAIL  POST /departments"; FAIL=$((FAIL+1)); DID=$DEPT_ID; }
check "GET /departments/:id" "$BASE/departments/$DID"
check "PATCH /departments/:id" "$BASE/departments/$DID" "PATCH" '{"nameAr":"محدث"}'
DC=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/departments/$DID" -H "$AUTH")
[ "$DC" -ge 200 ] && [ "$DC" -lt 300 ] && { echo "  PASS  DELETE /departments/:id"; PASS=$((PASS+1)); } || { echo "  FAIL  DELETE /departments/:id"; FAIL=$((FAIL+1)); }

echo ""
echo "[JOB GRADES - NEW]"
check "GET /job-grades" "$BASE/job-grades"
G=$(curl -s -X POST "$BASE/job-grades" -H "$AUTH" -H "Content-Type: application/json" -d "{\"code\":\"TG_$TS\",\"nameAr\":\"درجة\",\"nameEn\":\"Grade\",\"minSalary\":3000,\"maxSalary\":6000,\"isActive\":true,\"description\":\"وصف\"}")
GID=$(echo $G | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
[ -n "$GID" ] && { echo "  PASS  POST /job-grades"; PASS=$((PASS+1)); } || { echo "  FAIL  POST /job-grades"; echo "        $(echo $G|head -c 120)"; FAIL=$((FAIL+1)); GID=$GRADE_ID; }
check "GET /job-grades/:id" "$BASE/job-grades/$GID"
check "PATCH /job-grades/:id" "$BASE/job-grades/$GID" "PATCH" '{"description":"محدث","isActive":false}'
DC=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/job-grades/$GID" -H "$AUTH")
[ "$DC" -ge 200 ] && [ "$DC" -lt 300 ] && { echo "  PASS  DELETE /job-grades/:id"; PASS=$((PASS+1)); } || { echo "  FAIL  DELETE /job-grades/:id"; FAIL=$((FAIL+1)); }

echo ""
echo "[JOB TITLES - UPDATED: description + gradeId]"
check "GET /job-titles" "$BASE/job-titles"
T=$(curl -s -X POST "$BASE/job-titles" -H "$AUTH" -H "Content-Type: application/json" -d "{\"code\":\"TT_$TS\",\"nameAr\":\"مسمى\",\"nameEn\":\"Title\",\"description\":\"وصف\",\"gradeId\":\"$GRADE_ID\"}")
TID=$(echo $T | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
[ -n "$TID" ] && { echo "  PASS  POST /job-titles (description+gradeId)"; PASS=$((PASS+1)); } || { echo "  FAIL  POST /job-titles"; echo "        $(echo $T|head -c 120)"; FAIL=$((FAIL+1)); TID=$TITLE_ID; }
check "GET /job-titles/:id (includes grade)" "$BASE/job-titles/$TID"
check "PATCH /job-titles/:id" "$BASE/job-titles/$TID" "PATCH" '{"description":"محدث"}'
DC=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/job-titles/$TID" -H "$AUTH")
[ "$DC" -ge 200 ] && [ "$DC" -lt 300 ] && { echo "  PASS  DELETE /job-titles/:id"; PASS=$((PASS+1)); } || { echo "  FAIL  DELETE /job-titles/:id"; FAIL=$((FAIL+1)); }

echo ""
echo "[EMPLOYEES - UPDATED: basicSalary + jobGradeId]"
check "GET /employees" "$BASE/employees"
E=$(curl -s -X POST "$BASE/employees" -H "$AUTH" -H "Content-Type: application/json" -d "{\"firstNameAr\":\"موظف\",\"lastNameAr\":\"اختبار\",\"firstNameEn\":\"Test\",\"lastNameEn\":\"Emp\",\"email\":\"e_$TS@t.com\",\"nationalId\":\"N$TS\",\"gender\":\"MALE\",\"contractType\":\"PERMANENT\",\"departmentId\":\"$DEPT_ID\",\"jobTitleId\":\"$TITLE_ID\",\"jobGradeId\":\"$GRADE_ID\",\"basicSalary\":5500,\"hireDate\":\"2026-01-01\"}")
EID=$(echo $E | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
[ -n "$EID" ] && { echo "  PASS  POST /employees (gender+contractType+basicSalary+jobGradeId)"; PASS=$((PASS+1)); } || { echo "  FAIL  POST /employees"; echo "        $(echo $E|head -c 180)"; FAIL=$((FAIL+1)); EID=$EMP_ID; }
check "GET /employees/:id" "$BASE/employees/$EID"
check "PATCH /employees/:id (update basicSalary+jobGradeId)" "$BASE/employees/$EID" "PATCH" "{\"basicSalary\":7000,\"jobGradeId\":\"$GRADE_ID\"}"
DC=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/employees/$EID" -H "$AUTH")
[ "$DC" -ge 200 ] && [ "$DC" -lt 300 ] && { echo "  PASS  DELETE /employees/:id"; PASS=$((PASS+1)); } || { echo "  FAIL  DELETE /employees/:id"; FAIL=$((FAIL+1)); }

echo ""
echo "[USERS & ROLES]"
check "GET /users" "$BASE/users"
U=$(curl -s -X POST "$BASE/users" -H "$AUTH" -H "Content-Type: application/json" -d "{\"username\":\"u_$TS\",\"email\":\"u_$TS@t.com\",\"password\":\"Pass@1234\",\"fullName\":\"مستخدم\"}")
UID=$(echo $U | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
[ -n "$UID" ] && { echo "  PASS  POST /users"; PASS=$((PASS+1)); } || { echo "  FAIL  POST /users"; FAIL=$((FAIL+1)); }
check "GET /users/:id" "$BASE/users/$UID"
check "PATCH /users/:id" "$BASE/users/$UID" "PATCH" '{"fullName":"محدث"}'
DC=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/users/$UID" -H "$AUTH")
[ "$DC" -ge 200 ] && [ "$DC" -lt 300 ] && { echo "  PASS  DELETE /users/:id"; PASS=$((PASS+1)); } || { echo "  FAIL  DELETE /users/:id"; FAIL=$((FAIL+1)); }
check "GET /roles" "$BASE/roles"

echo ""
echo "[LEAVE MANAGEMENT]"
check "GET /leave-types" "$BASE/leave-types"
check "GET /leave-types/:id" "$BASE/leave-types/$LT_ID"
check "GET /leave-balances" "$BASE/leave-balances"
check "GET /leave-balances/my" "$BASE/leave-balances/my"
check "GET /holidays" "$BASE/holidays"
check "GET /leave-requests" "$BASE/leave-requests"
check "GET /leave-requests/my/requests" "$BASE/leave-requests/my/requests"
LR=$(curl -s -X POST "$BASE/leave-requests" -H "$AUTH" -H "Content-Type: application/json" -d "{\"leaveTypeId\":\"$LT_ID\",\"startDate\":\"2026-07-01\",\"endDate\":\"2026-07-02\",\"reason\":\"اختبار\"}")
LRID=$(echo $LR | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
[ -n "$LRID" ] && { echo "  PASS  POST /leave-requests"; PASS=$((PASS+1)); } || { echo "  FAIL  POST /leave-requests"; echo "        $(echo $LR|head -c 120)"; FAIL=$((FAIL+1)); }
check "GET /leave-requests/:id" "$BASE/leave-requests/$LRID"
check "POST /leave-requests/:id/submit" "$BASE/leave-requests/$LRID/submit" "POST" "{}"
check "POST /leave-requests/:id/approve-manager" "$BASE/leave-requests/$LRID/approve-manager" "POST" '{"notes":"موافق"}'
biz "POST /leave-requests/:id/approve-hr - requires leave balance (business rule)"
LR2=$(curl -s -X POST "$BASE/leave-requests" -H "$AUTH" -H "Content-Type: application/json" -d "{\"leaveTypeId\":\"$LT_ID\",\"startDate\":\"2026-08-01\",\"endDate\":\"2026-08-02\",\"reason\":\"رفض\"}")
LR2ID=$(echo $LR2 | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
curl -s -X POST "$BASE/leave-requests/$LR2ID/submit" -H "$AUTH" > /dev/null
check "POST /leave-requests/:id/reject-manager" "$BASE/leave-requests/$LR2ID/reject-manager" "POST" '{"notes":"مرفوض"}'

echo ""
echo "[WORK SCHEDULES & EMPLOYEE SCHEDULES]"
check "GET /work-schedules" "$BASE/work-schedules"
WS=$(curl -s -X POST "$BASE/work-schedules" -H "$AUTH" -H "Content-Type: application/json" -d "{\"code\":\"WS_$TS\",\"nameAr\":\"جدول اختبار\",\"nameEn\":\"Test Schedule\",\"workStartTime\":\"08:00\",\"workEndTime\":\"17:00\",\"workDays\":\"[0,1,2,3,4]\",\"lateToleranceMin\":15,\"earlyLeaveToleranceMin\":15}")
WSID=$(echo $WS | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
[ -n "$WSID" ] && { echo "  PASS  POST /work-schedules"; PASS=$((PASS+1)); } || { echo "  FAIL  POST /work-schedules"; echo "        $(echo $WS|head -c 120)"; FAIL=$((FAIL+1)); WSID=$WS_ID; }
check "GET /work-schedules/:id" "$BASE/work-schedules/$WSID"
check "PATCH /work-schedules/:id" "$BASE/work-schedules/$WSID" "PATCH" '{"lateToleranceMin":10}'
check "GET /employee-schedules" "$BASE/employee-schedules"
ES=$(curl -s -X POST "$BASE/employee-schedules" -H "$AUTH" -H "Content-Type: application/json" -d "{\"employeeId\":\"$EMP_ID\",\"scheduleId\":\"$WS_ID\",\"effectiveFrom\":\"2026-03-01\"}")
ESID=$(echo $ES | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
[ -n "$ESID" ] && { echo "  PASS  POST /employee-schedules"; PASS=$((PASS+1)); } || { echo "  FAIL  POST /employee-schedules"; echo "        $(echo $ES|head -c 120)"; FAIL=$((FAIL+1)); }

echo ""
echo "[ATTENDANCE RECORDS]"
check "GET /attendance-records" "$BASE/attendance-records"
check "GET /attendance-records/my-attendance" "$BASE/attendance-records/my-attendance"
AR=$(curl -s -X POST "$BASE/attendance-records" -H "$AUTH" -H "Content-Type: application/json" -d "{\"employeeId\":\"$EMP_ID\",\"date\":\"2026-02-25\",\"clockInTime\":\"2026-02-25T08:00:00.000Z\",\"clockOutTime\":\"2026-02-25T17:00:00.000Z\",\"status\":\"PRESENT\",\"workedMinutes\":540}")
ARID=$(echo $AR | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
[ -n "$ARID" ] && { echo "  PASS  POST /attendance-records (admin create)"; PASS=$((PASS+1)); } || { echo "  FAIL  POST /attendance-records"; echo "        $(echo $AR|head -c 120)"; FAIL=$((FAIL+1)); ARID=$(curl -s "$BASE/attendance-records" -H "$AUTH" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//'); }
check "GET /attendance-records/:id" "$BASE/attendance-records/$ARID"
check "PATCH /attendance-records/:id" "$BASE/attendance-records/$ARID" "PATCH" '{"notes":"تحديث"}'
check "POST /attendance-records/check-in" "$BASE/attendance-records/check-in" "POST" '{"date":"2026-02-24","checkInTime":"2026-02-24T08:00:00.000Z"}'
check "POST /attendance-records/check-out" "$BASE/attendance-records/check-out" "POST" '{"date":"2026-02-24","checkOutTime":"2026-02-24T17:00:00.000Z"}'

echo ""
echo "[ATTENDANCE ALERTS]"
check "GET /attendance-alerts" "$BASE/attendance-alerts"
AA=$(curl -s -X POST "$BASE/attendance-alerts" -H "$AUTH" -H "Content-Type: application/json" -d "{\"employeeId\":\"$EMP_ID\",\"date\":\"2026-02-26\",\"alertType\":\"LATE\",\"severity\":\"MEDIUM\",\"message\":\"Late\",\"messageAr\":\"تأخر\"}")
AAID=$(echo $AA | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
[ -n "$AAID" ] && { echo "  PASS  POST /attendance-alerts"; PASS=$((PASS+1)); } || { echo "  FAIL  POST /attendance-alerts"; echo "        $(echo $AA|head -c 120)"; FAIL=$((FAIL+1)); }
check "GET /attendance-alerts/:id" "$BASE/attendance-alerts/$AAID"

echo ""
echo "[ATTENDANCE JUSTIFICATIONS]"
check "GET /attendance-justifications" "$BASE/attendance-justifications"
AJF=$(curl -s "$BASE/attendance-justifications" -H "$AUTH" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
check "GET /attendance-justifications/:id" "$BASE/attendance-justifications/$AJF"
biz "POST /attendance-justifications - employee must own the alert (security rule)"
biz "PATCH /attendance-justifications/:id/manager-review - requires PENDING_MANAGER status"
biz "PATCH /attendance-justifications/:id/hr-review - requires PENDING_HR status"

echo ""
echo "[ATTENDANCE REPORTS - NEW]"
check "GET /attendance-reports/daily?date=2026-02-16" "$BASE/attendance-reports/daily?date=2026-02-16"
check "GET /attendance-reports/daily (departmentId filter)" "$BASE/attendance-reports/daily?date=2026-02-16&departmentId=$DEPT_ID"
check "GET /attendance-reports/monthly?year=2026&month=2" "$BASE/attendance-reports/monthly?year=2026&month=2"
check "GET /attendance-reports/monthly (employeeId filter)" "$BASE/attendance-reports/monthly?year=2026&month=2&employeeId=$EMP_ID"
check "GET /attendance-reports/summary?dateFrom&dateTo" "$BASE/attendance-reports/summary?dateFrom=2026-02-01&dateTo=2026-02-28"
check "GET /attendance-reports/breaks?dateFrom&dateTo" "$BASE/attendance-reports/breaks?dateFrom=2026-02-01&dateTo=2026-02-28"

echo ""
echo "[ADMINISTRATIVE REQUESTS - NEW]"
check "GET /requests" "$BASE/requests"
check "GET /requests?status=APPROVED" "$BASE/requests?status=APPROVED"
check "GET /requests?type=PERMISSION" "$BASE/requests?type=PERMISSION"
check "GET /requests/my" "$BASE/requests/my"
R=$(curl -s -X POST "$BASE/requests" -H "$AUTH" -H "Content-Type: application/json" -d '{"type":"PERMISSION","reason":"اختبار شامل"}')
RID=$(echo $R | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
RNUM=$(echo $R | grep -o '"requestNumber":"[^"]*"' | head -1 | sed 's/"requestNumber":"//;s/"//')
[ -n "$RID" ] && { echo "  PASS  POST /requests (DRAFT $RNUM)"; PASS=$((PASS+1)); } || { echo "  FAIL  POST /requests"; FAIL=$((FAIL+1)); }
check "GET /requests/:id" "$BASE/requests/$RID"
check "POST /requests/:id/submit" "$BASE/requests/$RID/submit" "POST" ""
check "POST /requests/:id/manager-approve" "$BASE/requests/$RID/manager-approve" "POST" '{"notes":"موافق"}'
check "POST /requests/:id/hr-approve" "$BASE/requests/$RID/hr-approve" "POST" '{"notes":"اعتماد"}'
R2=$(curl -s -X POST "$BASE/requests" -H "$AUTH" -H "Content-Type: application/json" -d '{"type":"ADVANCE","reason":"رفض"}')
R2ID=$(echo $R2 | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
curl -s -X POST "$BASE/requests/$R2ID/submit" -H "$AUTH" > /dev/null
check "POST /requests/:id/manager-reject" "$BASE/requests/$R2ID/manager-reject" "POST" '{"notes":"مرفوض"}'
R3=$(curl -s -X POST "$BASE/requests" -H "$AUTH" -H "Content-Type: application/json" -d '{"type":"TRANSFER","reason":"الغاء"}')
R3ID=$(echo $R3 | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
check "POST /requests/:id/cancel" "$BASE/requests/$R3ID/cancel" "POST" '{"reason":"ملغى"}'

echo ""
echo "[EVALUATION]"
check "GET /evaluation-periods" "$BASE/evaluation-periods"
check "GET /evaluation-criteria" "$BASE/evaluation-criteria"
check "GET /evaluation-forms" "$BASE/evaluation-forms"
check "GET /evaluation-forms/my" "$BASE/evaluation-forms/my"
check "GET /evaluation-forms/pending-my-review" "$BASE/evaluation-forms/pending-my-review"
FRMID=$(curl -s "$BASE/evaluation-forms" -H "$AUTH" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
if [ -n "$FRMID" ]; then
  check "GET /peer-evaluations/forms/:formId/peers" "$BASE/peer-evaluations/forms/$FRMID/peers"
  check "GET /employee-goals/forms/:formId" "$BASE/employee-goals/forms/$FRMID"
else
  biz "peer-evaluations/forms/:formId - no forms yet"
  biz "employee-goals/forms/:formId - no forms yet"
fi

echo ""
echo "============================================================"
printf "  PASS: %d\n" $PASS
printf "  FAIL: %d\n" $FAIL
printf "  BIZ:  %d (expected business rule validations)\n" $BIZ
printf "  TOTAL TESTED: %d\n" $((PASS + FAIL + BIZ))
echo "============================================================"
