#!/bin/sh
set -e

npx prisma migrate resolve --applied "20260117102359_init_users"                          || true
npx prisma migrate resolve --applied "20260117130511_add_employees_departments"           || true
npx prisma migrate resolve --applied "20260117132036_add_roles_permissions"               || true
npx prisma migrate resolve --applied "20260226000001_add_job_title_description"           || true
npx prisma migrate resolve --applied "20260226000002_add_employee_salary"                 || true
npx prisma migrate resolve --applied "20260226000003_add_job_grades"                      || true
npx prisma migrate resolve --applied "20260316000001_contract_qualifications_allowances"  || true
npx prisma migrate resolve --applied "20260316000002_requests_permissions"                || true
npx prisma migrate resolve --applied "20260324000001_update_allowance_types"              || true
npx prisma migrate resolve --applied "20260405000001_add_probation_result"                || true
npx prisma migrate resolve --applied "20260405000002_create_audit_logs"                   || true
npx prisma migrate resolve --applied "20260405000003_add_notifications"                   || true
npx prisma migrate resolve --applied "20260406000001_add_onboarding"                      || true
npx prisma migrate resolve --applied "20260406000002_add_documents"                       || true
npx prisma migrate resolve --applied "20260408000001_add_order_driving_residence"         || true
npx prisma migrate resolve --applied "20260412000001_add_department_grade"                || true
npx prisma migrate resolve --applied "20260418000001_add_university_fields_permanent"     || true
npx prisma migrate resolve --applied "20260418000002_add_contract_types"                  || true
npx prisma migrate resolve --applied "20260418000003_add_work_type"                       || true
npx prisma migrate resolve --applied "20260418000004_add_missing_employee_fields"         || true
npx prisma migrate resolve --applied "20260418000005_add_unspecified_to_enums"            || true
npx prisma migrate resolve --applied "20260420000001_add_exit_interview_evaluation"       || true
npx prisma migrate resolve --applied "20260420000002_interview_evaluation_to_text"        || true
npx prisma migrate resolve --applied "20260423000001_add_department_media"                || true
npx prisma migrate resolve --applied "20260425000004_mail_permissions"                    || true
npx prisma migrate resolve --applied "20260428000001_add_manager_notes_first_login_enums" || true
npx prisma migrate resolve --applied "20260428000002_add_hr_report_permissions"           || true
npx prisma migrate resolve --applied "20260428000003_add_system_user"                     || true
npx prisma migrate resolve --applied "20260502000001_add_salary_raise_probation_result"   || true
npx prisma migrate resolve --applied "20260507000001_custody_serial_partial_unique"       || true
npx prisma migrate resolve --applied "20260507_permission_audit_log_and_groups"           || true
npx prisma migrate resolve --applied "20260517000001_add_assignment_notification_types"   || true
npx prisma migrate resolve --applied "20260518000001_add_payroll_advances_commissions_daily_wage" || true

npx prisma migrate deploy

exec node dist/apps/users/src/main.js
