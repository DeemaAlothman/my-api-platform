import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding attendance...');

  // work_schedules
  await prisma.$executeRawUnsafe(`
INSERT INTO attendance.work_schedules (id, code, "nameAr", "nameEn", description, "workStartTime", "workEndTime", "breakStartTime", "breakEndTime", "breakDurationMin", "workDays", "lateToleranceMin", "earlyLeaveToleranceMin", "allowOvertime", "maxOvertimeHours", "isDefault", "isActive", "createdAt", "updatedAt", "minimumWorkMinutes", "requiresContinuousWork", "holidayMultiplier", "shiftType")
VALUES
  ('82e529ff-7bad-4049-9eb4-3dfe606c3e5e', 'MAIN_10_18', 'الوردية الأساسية', 'Primary Shift', NULL, '10:00', '18:00', NULL, NULL, 60, '[0,1,2,3,4,6]', 15, 0, TRUE, 4, FALSE, TRUE, '2026-04-26 11:21:58.474', '2026-04-26 12:19:59.469', NULL, FALSE, NULL, 'DAY'),
  ('c8d4dd7e-d2ff-4794-9056-5078954f2d45', 'FOURTH_930_1630', 'وردية ', '9:30 - 4:30', NULL, '09:30', '16:30', NULL, NULL, 60, '[0,1,2,3,4,6]', 15, 0, TRUE, 4, FALSE, TRUE, '2026-04-26 11:21:58.474', '2026-04-26 12:20:31.387', NULL, FALSE, NULL, 'DAY'),
  ('87f7d75e-d9d0-4cbf-ad4d-0a06fab36362', 'ACCOUNTANT_10_13', 'وردية المحاسب ', '(3 ساعات متواصلة)', NULL, '10:00', '13:00', NULL, NULL, 0, '[0,1,2,3,4,6]', 15, 0, FALSE, 0, FALSE, TRUE, '2026-04-26 11:21:58.474', '2026-04-26 12:20:53.041', 180, TRUE, NULL, 'FLEXIBLE'),
  ('bf40b137-174f-427a-b177-1db984b47b6a', 'SECOND_9_16', 'الوردية الثانية', 'Second Shift', NULL, '09:00', '16:00', NULL, NULL, 60, '[0,1,2,3,4,6]', 15, 0, TRUE, 4, FALSE, TRUE, '2026-04-26 11:21:58.474', '2026-04-26 12:21:43.801', NULL, FALSE, NULL, 'DAY')
ON CONFLICT DO NOTHING;
  `);

  // deduction_policies
  await prisma.$executeRawUnsafe(`
INSERT INTO attendance.deduction_policies (id, "nameAr", "nameEn", "isDefault", "lateToleranceMinutes", "lateDeductionType", "lateDeductionTiers", "earlyLeaveDeductionType", "absenceDeductionDays", "repeatLateThreshold", "repeatLatePenaltyDays", "breakOverLimitDeduction", "isActive", "createdAt", "updatedAt", "monthlyLateToleranceMinutes", "excludedAllowanceTypes", "effectiveFrom")
VALUES
  ('dp000001-0000-0000-0000-000000000000', 'السياسة الافتراضية', 'Default Policy', FALSE, 15, 'MINUTE_BY_MINUTE', NULL, 'MINUTE_BY_MINUTE', 1, 3, 0.5, 'MINUTE_BY_MINUTE', TRUE, '2026-04-12 11:39:42.159', '2026-04-26 11:50:42.866', 120, '["FOOD"]', '2026-04-25 10:34:03.284'),
  ('4e668caf-0009-4c00-a92c-38678e411bf8', 'سياسات الحسم', 'Discount Policies', FALSE, 15, 'TIERED', '[{"fromMinute":16,"toMinute":60,"deductionDays":0.25},{"fromMinute":61,"toMinute":120,"deductionDays":0.5}]', 'TIERED', 2.75, NULL, NULL, 'MINUTE_BY_MINUTE', TRUE, '2026-04-26 11:49:24.846', '2026-05-03 09:55:13.266', 120, '["FOOD"]', '2026-04-26 11:49:24.846'),
  ('60a19d0f-658a-44fa-829a-19cf00e174fa', 'سياسات الحسم', 'Discount Policies', TRUE, 15, 'TIERED', '[{"fromMinute":16,"toMinute":60,"deductionDays":0.25},{"fromMinute":61,"toMinute":120,"deductionDays":0.5}]', 'TIERED', 1.5, NULL, NULL, 'MINUTE_BY_MINUTE', TRUE, '2026-04-26 11:52:44.191', '2026-05-03 09:55:13.27', 120, '["FOOD"]', '2026-04-26 11:52:44.191')
ON CONFLICT DO NOTHING;
  `);

  // attendance_settings
  await prisma.$executeRawUnsafe(`
INSERT INTO attendance.attendance_settings (id, key, value, description, "createdAt", "updatedAt")
VALUES
  ('4e74cc21-3a79-4ad3-885e-b74b73aacade', 'LATE_TOLERANCE_MINUTES', 15, 'دقائق السماح للتأخير', '2026-04-12 11:39:42.142', '2026-04-12 11:39:42.142'),
  ('a1f51f46-1e22-4903-b122-1d6985f279c8', 'ABSENT_AFTER_HOURS', 4, 'ساعات الغياب الكامل', '2026-04-12 11:39:42.151', '2026-04-12 11:39:42.151'),
  ('cfacd40d-1aab-470e-a337-e10ec6983548', 'OVERTIME_START_AFTER', 30, 'بداية الأوفر تايم بعد نهاية الدوام (دقيقة)', '2026-04-12 11:39:42.153', '2026-04-12 11:39:42.153'),
  ('c369a3fe-b4ed-432f-a9a6-0b245482a281', 'MAX_BREAK_MINUTES', 60, 'الحد الأقصى للاستراحة', '2026-04-12 11:39:42.156', '2026-04-12 11:39:42.156')
ON CONFLICT DO NOTHING;
  `);

  // employee_schedules
  await prisma.$executeRawUnsafe(`
INSERT INTO attendance.employee_schedules (id, "employeeId", "scheduleId", "effectiveFrom", "effectiveTo", "isActive", "createdAt", "updatedAt")
VALUES
  ('14d34608-3a25-4283-bc5c-7d001b320031', 'df7822fd-6d6c-4a59-bed4-1f9b138de589', '82e529ff-7bad-4049-9eb4-3dfe606c3e5e', '2026-04-29 00:00:00', NULL, TRUE, '2026-04-28 11:42:07.965', '2026-04-28 11:42:07.965'),
  ('d42f9f48-a130-49a6-a34e-aa5506537dcd', 'ddd11482-a538-4ac7-ba9f-828dffe625a2', '82e529ff-7bad-4049-9eb4-3dfe606c3e5e', '2026-04-29 00:00:00', NULL, TRUE, '2026-04-28 11:43:26.2', '2026-04-28 11:43:26.2'),
  ('e0f27fa3-cc9e-41bc-a64f-e48497c5df5c', '033a093d-516a-4e48-b226-2c38825f2e2d', '82e529ff-7bad-4049-9eb4-3dfe606c3e5e', '2026-04-29 00:00:00', NULL, TRUE, '2026-04-28 11:43:48.651', '2026-04-28 11:43:48.651'),
  ('881a450a-406c-405e-93cc-7feac79ad2fc', 'af567b7b-4b44-4b25-a404-6dfade9eed93', '82e529ff-7bad-4049-9eb4-3dfe606c3e5e', '2026-04-29 00:00:00', NULL, TRUE, '2026-04-28 11:44:02.328', '2026-04-28 11:44:02.328'),
  ('33df41ae-e5ec-4aa1-b3b8-7d5c3890af54', '85ccfa18-70c7-4d25-afbf-33b830a259a5', '82e529ff-7bad-4049-9eb4-3dfe606c3e5e', '2026-04-29 00:00:00', NULL, TRUE, '2026-04-28 11:44:16.582', '2026-04-28 11:44:16.582'),
  ('a43d4447-506f-43df-be32-ed95af4ab795', '71e0bdfd-81f4-4e0a-88e9-f0b8035b8f81', '82e529ff-7bad-4049-9eb4-3dfe606c3e5e', '2026-04-29 00:00:00', NULL, TRUE, '2026-04-28 11:44:29.389', '2026-04-28 11:44:29.389'),
  ('a8b37285-a6f0-4290-90fd-4a44e7edd09e', 'b32ddbc0-d681-4c4a-a9b9-3b08e94d3c4d', '82e529ff-7bad-4049-9eb4-3dfe606c3e5e', '2026-04-29 00:00:00', NULL, TRUE, '2026-04-28 11:44:44.612', '2026-04-28 11:44:44.612'),
  ('56370a51-30e6-4365-bf45-5bf2419b0848', '5fee0b49-3a07-4c3d-b49c-b3c8d4a90afe', '82e529ff-7bad-4049-9eb4-3dfe606c3e5e', '2026-04-29 00:00:00', NULL, TRUE, '2026-04-28 11:45:30.649', '2026-04-28 11:45:30.649'),
  ('40976441-d608-45a5-b0e0-649ac6a71de4', 'ba812804-8edc-4671-9e21-d885d9b01f7c', '82e529ff-7bad-4049-9eb4-3dfe606c3e5e', '2026-04-29 00:00:00', NULL, TRUE, '2026-04-28 11:45:48.324', '2026-04-28 11:45:48.324'),
  ('b18d8312-9b58-4cb7-a755-9a9a6b8a7c8c', '796045cf-91bb-4ffa-aaeb-642bb6ca1a92', '82e529ff-7bad-4049-9eb4-3dfe606c3e5e', '2026-04-29 00:00:00', NULL, TRUE, '2026-04-28 11:46:02.527', '2026-04-28 11:46:02.527'),
  ('bdf23ce9-7257-4fc2-803d-8944bdf85d87', '322175e9-ff96-4b9d-aae7-bd0e0360873a', '82e529ff-7bad-4049-9eb4-3dfe606c3e5e', '2026-04-29 00:00:00', NULL, TRUE, '2026-04-28 11:46:33.217', '2026-04-28 11:46:33.217'),
  ('7a282fe7-b459-4123-a1cd-da4024521710', '4cd33487-6cf7-4e55-853d-1a16cfe9c673', 'bf40b137-174f-427a-b177-1db984b47b6a', '2026-04-29 00:00:00', NULL, TRUE, '2026-04-28 11:46:56.575', '2026-04-28 11:46:56.575'),
  ('f4f42e23-f762-4f03-8894-2e8028338368', '6df7e800-f666-4055-b4fe-f8ae46df4b91', '82e529ff-7bad-4049-9eb4-3dfe606c3e5e', '2026-04-29 00:00:00', NULL, TRUE, '2026-04-28 11:47:42.85', '2026-04-28 11:47:42.85'),
  ('541d7cf0-9717-4ced-8600-dceaf174c7e4', '7e4fab53-253a-4948-a165-b779be5f0fa2', '82e529ff-7bad-4049-9eb4-3dfe606c3e5e', '2026-04-29 00:00:00', NULL, TRUE, '2026-04-28 11:48:27.072', '2026-04-28 11:48:27.072'),
  ('097909db-3d01-446e-9370-fdcbf082122c', '4abc7633-8231-47a9-962d-c22c1560a2a7', 'bf40b137-174f-427a-b177-1db984b47b6a', '2026-04-29 00:00:00', NULL, TRUE, '2026-04-28 11:48:47.094', '2026-04-28 11:48:47.094'),
  ('6477a06b-abf1-453c-9f0e-4f523d635967', '8ba25e1e-e094-465b-b766-973a94d3b1e2', '82e529ff-7bad-4049-9eb4-3dfe606c3e5e', '2026-04-29 00:00:00', NULL, TRUE, '2026-04-28 11:49:14.304', '2026-04-28 11:49:14.304'),
  ('accc60ae-caba-4601-b3c8-0cd543f4db94', '0e5c8e2a-3bf7-4fa3-871a-daf698e472c2', '82e529ff-7bad-4049-9eb4-3dfe606c3e5e', '2026-04-29 00:00:00', NULL, TRUE, '2026-04-28 11:49:32.034', '2026-04-28 11:49:32.034'),
  ('d16f3adf-6210-425a-9102-b88a58262983', 'f7b08e76-211f-4692-9f90-1b14b1fb4553', '82e529ff-7bad-4049-9eb4-3dfe606c3e5e', '2026-04-29 00:00:00', NULL, TRUE, '2026-04-28 11:49:55.42', '2026-04-28 11:49:55.42'),
  ('b5c5222e-67dd-4a50-93c3-bc334dfe603f', '97c4bab1-09ef-4c4c-a689-b0fd8a57ad23', '82e529ff-7bad-4049-9eb4-3dfe606c3e5e', '2026-04-29 00:00:00', NULL, TRUE, '2026-04-28 11:50:11.026', '2026-04-28 11:50:11.026'),
  ('0c738e05-30e7-48c9-b3d7-0742a234c7e2', 'dec29623-fb25-4317-bf05-8a958751a3f2', '82e529ff-7bad-4049-9eb4-3dfe606c3e5e', '2026-04-29 00:00:00', NULL, TRUE, '2026-04-28 11:50:49.061', '2026-04-28 11:50:49.061'),
  ('f50acda0-373a-4328-b70d-7bf318cb077f', '6a888f6f-4158-4da1-b528-eb013b63876d', '82e529ff-7bad-4049-9eb4-3dfe606c3e5e', '2026-04-29 00:00:00', NULL, TRUE, '2026-04-28 11:51:30.852', '2026-04-28 11:51:30.852'),
  ('7cff0caa-fda3-411f-8383-cd4f737942d6', 'ba304ac3-3d35-4e2a-a734-d428953a7696', '82e529ff-7bad-4049-9eb4-3dfe606c3e5e', '2026-04-29 00:00:00', NULL, TRUE, '2026-04-28 11:51:44.511', '2026-04-28 11:51:44.511'),
  ('0d0a8dc0-822a-44d8-b76a-ece9ab40494c', '49b89799-fb65-4e3e-a93e-20c6643dccdb', '87f7d75e-d9d0-4cbf-ad4d-0a06fab36362', '2026-05-01 00:00:00', NULL, TRUE, '2026-04-30 19:16:12.697', '2026-04-30 19:16:12.697')
ON CONFLICT DO NOTHING;
  `);

  console.log('attendance seeding done.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
