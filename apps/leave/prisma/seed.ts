import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding leave...');

  // leave_types
  await prisma.$executeRawUnsafe(`
INSERT INTO leaves.leave_types (id, code, "nameAr", "nameEn", "defaultDays", "isPaid", "requiresApproval", "requiresAttachment", "maxDaysPerRequest", "minDaysNotice", "allowHalfDay", color, "isActive", "createdAt", "updatedAt", "minServiceMonths", "maxLifetimeUsage", "salaryDeductionRules", "maxHoursPerMonth")
VALUES
  ('345c3487-4ecc-4750-b58a-fafae3d90790', 'ANNUAL', 'إجازة سنوية', 'Annual Leave', 14, TRUE, TRUE, FALSE, 30, 3, TRUE, '#4CAF50', TRUE, '2026-04-14 22:53:11.997', '2026-04-29 11:00:29.069', NULL, NULL, NULL, NULL),
  ('e3569b41-5fd2-445b-8a11-c1bc6da94486', 'SICK', 'إجازة مرضية', 'Sick Leave', 180, TRUE, TRUE, TRUE, 180, 0, FALSE, '#FF9800', TRUE, '2026-04-20 10:51:42.005', '2026-04-29 11:00:29.075', NULL, NULL, '[{"toDay": 90, "fromDay": 1, "deductionPercent": 30}, {"toDay": 180, "fromDay": 91, "deductionPercent": 20}]', NULL),
  ('75ae7b48-cf57-406c-91dc-1087649c4b6e', 'MARRIAGE', 'إجازة زواج', 'Marriage Leave', 7, TRUE, TRUE, TRUE, 7, 14, FALSE, '#9C27B0', TRUE, '2026-04-29 11:00:29.086', '2026-04-29 11:00:29.086', 6, NULL, NULL, NULL),
  ('645b4b22-d030-48f3-bbd5-f5f4cbe2bbfe', 'BEREAVEMENT', 'إجازة وفاة', 'Bereavement Leave', 5, TRUE, TRUE, TRUE, 5, 0, FALSE, '#607D8B', TRUE, '2026-04-29 11:00:29.088', '2026-04-29 11:00:29.088', NULL, NULL, NULL, NULL),
  ('1293555a-3fcd-46cc-bcc1-07150c555308', 'UNPAID', 'إجازة بدون راتب', 'Unpaid Leave', 0, FALSE, TRUE, FALSE, NULL, 7, FALSE, '#9E9E9E', TRUE, '2026-04-29 11:00:29.093', '2026-04-29 11:00:29.093', NULL, NULL, NULL, NULL),
  ('6f06298d-bf8a-450b-915a-0835884c456d', 'HAJJ', 'إجازة حج', 'Hajj Leave', 30, TRUE, TRUE, TRUE, 30, 60, FALSE, '#795548', TRUE, '2026-04-29 11:00:29.095', '2026-04-29 11:00:29.095', 60, 1, NULL, NULL),
  ('0c66e192-f012-4df0-9029-93b9dcdc2747', 'STUDY', 'إجازة دراسية', 'Study Leave', 10, TRUE, TRUE, TRUE, 10, 30, FALSE, '#00BCD4', TRUE, '2026-04-29 11:00:29.09', '2026-04-30 09:40:47.592', 12, NULL, NULL, NULL),
  ('5aa454f2-570d-4cf5-a0ae-86fdf754f1ee', 'PATERNITY', 'إجازة أبوة', 'Paternity Leave', 0, FALSE, TRUE, TRUE, NULL, 0, FALSE, '#2196F3', TRUE, '2026-04-29 11:00:29.084', '2026-04-30 09:40:47.594', NULL, NULL, NULL, NULL),
  ('9127a307-2100-45ad-9f68-7c4f6b718a3d', 'MATERNITY', 'إجازة أمومة', 'Maternity Leave', 120, TRUE, TRUE, TRUE, 120, 30, FALSE, '#E91E63', TRUE, '2026-04-29 11:00:29.081', '2026-04-30 09:40:47.595', NULL, 1, NULL, NULL),
  ('8981bc0c-34c5-4fc0-bdbe-5d2319ffbfb7', 'HOURLY', 'إجازة ساعية', 'Hourly Leave', 0, TRUE, TRUE, FALSE, NULL, 0, FALSE, '#FFC107', TRUE, '2026-04-29 12:56:25.372', '2026-04-30 09:40:47.596', NULL, NULL, NULL, 2),
  ('b4a76632-ed2c-4248-aab8-3b90e8756ee9', 'BIRTH', 'إجازة مولود', 'Birth Leave', 3, TRUE, TRUE, TRUE, 3, 0, FALSE, '#03A9F4', TRUE, '2026-04-29 17:56:09.816', '2026-04-30 09:40:47.596', NULL, NULL, NULL, NULL),
  ('7d568a69-853b-4657-a624-371b0c7102dd', 'UNPAID_DAILY', 'إجازة نصف يوم / يوم غير مدفوعة', 'Unpaid Daily/Half-day Leave', 0, FALSE, TRUE, FALSE, NULL, 0, TRUE, '#FF5722', TRUE, '2026-04-29 17:56:09.817', '2026-04-30 09:40:47.597', NULL, NULL, NULL, NULL),
  ('619f88d4-8381-47c6-8645-7a7feb28f660', 'EMERGENCY', 'إجازة طارئة', 'Emergency Leave', 5, TRUE, TRUE, FALSE, 3, 0, FALSE, '#F44336', FALSE, '2026-04-29 11:00:29.078', '2026-05-04 12:09:24.09', NULL, NULL, NULL, NULL)
ON CONFLICT DO NOTHING;
  `);

  // holidays
  await prisma.$executeRawUnsafe(`
INSERT INTO leaves.holidays (id, "nameAr", "nameEn", date, "endDate", type, "isRecurring", year, "createdAt", "updatedAt")
VALUES
  ('7011b7d7-ce27-4991-b668-c6050d9f13b7', 'رأس السنة الميلادية', 'New Year', '2024-01-01 00:00:00', NULL, 'PUBLIC', TRUE, 2024, '2026-04-29 11:00:29.098', '2026-04-29 11:00:29.098'),
  ('6d0da6d4-6f49-46a4-b4a4-56fc08c0c017', 'عيد الفطر', 'Eid Al-Fitr', '2024-04-10 00:00:00', '2024-04-13 00:00:00', 'RELIGIOUS', FALSE, 2024, '2026-04-29 11:00:29.1', '2026-04-29 11:00:29.1'),
  ('199c761f-5752-4b9d-97f8-bb59ae4e0d90', 'عيد الأضحى', 'Eid Al-Adha', '2024-06-15 00:00:00', '2024-06-19 00:00:00', 'RELIGIOUS', FALSE, 2024, '2026-04-29 11:00:29.102', '2026-04-29 11:00:29.102'),
  ('8f5b1d46-e58a-4c47-af82-6a2a5211956e', 'رأس السنة الهجرية', 'Islamic New Year', '2024-07-07 00:00:00', NULL, 'RELIGIOUS', FALSE, 2024, '2026-04-29 11:00:29.104', '2026-04-29 11:00:29.104'),
  ('daba7adf-e02d-44ef-9e6e-39036d1a77c7', 'المولد النبوي الشريف', 'Prophet''s Birthday', '2024-09-15 00:00:00', NULL, 'RELIGIOUS', FALSE, 2024, '2026-04-29 11:00:29.105', '2026-04-29 11:00:29.105'),
  ('cb2c9831-d5c8-49ee-bfd4-106b62fa7f44', 'اليوم الوطني', 'National Day', '2024-09-23 00:00:00', NULL, 'NATIONAL', TRUE, 2024, '2026-04-29 11:00:29.106', '2026-04-29 11:00:29.106'),
  ('660dad7f-e9e7-4568-aeec-852e7f6e2039', 'رأس السنة الميلادية', 'New Year', '2025-01-01 00:00:00', NULL, 'PUBLIC', TRUE, 2025, '2026-04-29 11:00:29.108', '2026-04-29 11:00:29.108'),
  ('493e05d5-e772-4ef4-a53f-9c892d940377', 'عيد الفطر', 'Eid Al-Fitr', '2025-03-30 00:00:00', '2025-04-02 00:00:00', 'RELIGIOUS', FALSE, 2025, '2026-04-29 11:00:29.109', '2026-04-29 11:00:29.109'),
  ('b0323562-5b5c-464b-921e-56f87e9ca95e', 'عيد الأضحى', 'Eid Al-Adha', '2025-06-06 00:00:00', '2025-06-10 00:00:00', 'RELIGIOUS', FALSE, 2025, '2026-04-29 11:00:29.111', '2026-04-29 11:00:29.111'),
  ('4f8c32e2-3f77-497c-84f0-856d7046ecda', 'رأس السنة الهجرية', 'Islamic New Year', '2025-06-26 00:00:00', NULL, 'RELIGIOUS', FALSE, 2025, '2026-04-29 11:00:29.112', '2026-04-29 11:00:29.112'),
  ('1ef01ada-b67c-4da7-802b-8c6384341860', 'المولد النبوي الشريف', 'Prophet''s Birthday', '2025-09-04 00:00:00', NULL, 'RELIGIOUS', FALSE, 2025, '2026-04-29 11:00:29.113', '2026-04-29 11:00:29.113'),
  ('6bfbc086-b94d-4938-899e-0b0b355a9bda', 'اليوم الوطني', 'National Day', '2025-09-23 00:00:00', NULL, 'NATIONAL', TRUE, 2025, '2026-04-29 11:00:29.115', '2026-04-29 11:00:29.115'),
  ('a658bef7-3a99-4fc8-a2fd-6c0c58149f29', 'رأس السنة الميلادية', 'New Year', '2026-01-01 00:00:00', NULL, 'PUBLIC', TRUE, 2026, '2026-04-29 11:00:29.116', '2026-04-29 11:00:29.116'),
  ('cac6dd17-72a1-40d1-b1f0-1bfb30a4ff6f', 'المولد النبوي الشريف', 'Prophet''s Birthday', '2026-08-25 00:00:00', NULL, 'RELIGIOUS', FALSE, 2026, '2026-04-29 11:00:29.121', '2026-04-29 11:00:29.121'),
  ('36ea6530-331a-43b5-a722-ef081b15fcd7', 'عيد الفطر', 'Eid Al-Fitr', '2026-03-20 00:00:00', '2026-03-23 00:00:00', 'RELIGIOUS', TRUE, 2026, '2026-04-29 11:00:29.118', '2026-04-30 18:59:11.888'),
  ('4f5ef2a5-4d41-4d73-aa1f-73161b3c3323', 'عيد الأضحى', 'Eid Al-Adha', '2026-05-27 00:00:00', '2026-05-31 00:00:00', 'RELIGIOUS', TRUE, 2026, '2026-04-29 11:00:29.119', '2026-04-30 18:59:22.522'),
  ('56925807-0e0d-4144-b0a4-ce3fd4d730d9', 'رأس السنة الهجرية', 'Islamic New Year', '2026-06-16 00:00:00', NULL, 'RELIGIOUS', TRUE, 2026, '2026-04-29 11:00:29.12', '2026-04-30 18:59:45.624')
ON CONFLICT DO NOTHING;
  `);

  // leave_balances
  await prisma.$executeRawUnsafe(`
INSERT INTO leaves.leave_balances (id, "employeeId", "leaveTypeId", year, "totalDays", "usedDays", "pendingDays", "remainingDays", "carriedOverDays", "adjustmentDays", "adjustmentReason", "createdAt", "updatedAt", "usedHours", "pendingHours")
VALUES
  ('19ff444d-a0e3-4de2-ba00-0afce55b8f5a', 'df7822fd-6d6c-4a59-bed4-1f9b138de589', '345c3487-4ecc-4750-b58a-fafae3d90790', 2026, 10.5, 0, 0, 10.5, 0, 0, NULL, '2026-05-03 10:02:22.853', '2026-05-03 10:02:22.853', 0, 0),
  ('e001a274-456f-46d8-9b16-15d7836e2eae', 'df7822fd-6d6c-4a59-bed4-1f9b138de589', 'e3569b41-5fd2-445b-8a11-c1bc6da94486', 2026, 180, 0, 0, 180, 0, 0, NULL, '2026-05-03 10:02:22.858', '2026-05-03 10:02:22.858', 0, 0),
  ('045dc5b9-82e5-42f9-b1fd-9de3771a8c95', 'df7822fd-6d6c-4a59-bed4-1f9b138de589', '619f88d4-8381-47c6-8645-7a7feb28f660', 2026, 5, 0, 0, 5, 0, 0, NULL, '2026-05-03 10:02:22.861', '2026-05-03 10:02:22.861', 0, 0),
  ('62b858b3-391f-4840-9d14-5469221536c3', 'df7822fd-6d6c-4a59-bed4-1f9b138de589', '75ae7b48-cf57-406c-91dc-1087649c4b6e', 2026, 7, 0, 0, 7, 0, 0, NULL, '2026-05-03 10:02:22.865', '2026-05-03 10:02:22.865', 0, 0),
  ('cead8c87-5c5b-4e63-9dfb-9d431760b434', 'df7822fd-6d6c-4a59-bed4-1f9b138de589', '645b4b22-d030-48f3-bbd5-f5f4cbe2bbfe', 2026, 5, 0, 0, 5, 0, 0, NULL, '2026-05-03 10:02:22.868', '2026-05-03 10:02:22.868', 0, 0),
  ('ed9820df-7cc2-45b7-aec5-461139eee124', 'df7822fd-6d6c-4a59-bed4-1f9b138de589', '1293555a-3fcd-46cc-bcc1-07150c555308', 2026, 0, 0, 0, 0, 0, 0, NULL, '2026-05-03 10:02:22.871', '2026-05-03 10:02:22.871', 0, 0),
  ('c6c7b820-70af-4561-9a0c-1d52dddc1636', 'df7822fd-6d6c-4a59-bed4-1f9b138de589', '6f06298d-bf8a-450b-915a-0835884c456d', 2026, 30, 0, 0, 30, 0, 0, NULL, '2026-05-03 10:02:22.875', '2026-05-03 10:02:22.875', 0, 0),
  ('96febc15-3b01-40ce-9ae5-e75f9a0ec24d', 'df7822fd-6d6c-4a59-bed4-1f9b138de589', '0c66e192-f012-4df0-9029-93b9dcdc2747', 2026, 10, 0, 0, 10, 0, 0, NULL, '2026-05-03 10:02:22.878', '2026-05-03 10:02:22.878', 0, 0),
  ('7f6b9b31-ee9f-49c3-bda3-cecb2dba9d09', 'df7822fd-6d6c-4a59-bed4-1f9b138de589', '5aa454f2-570d-4cf5-a0ae-86fdf754f1ee', 2026, 0, 0, 0, 0, 0, 0, NULL, '2026-05-03 10:02:22.88', '2026-05-03 10:02:22.88', 0, 0),
  ('c9c39dd4-e719-4c7f-83a4-bf4474f8f7a6', 'df7822fd-6d6c-4a59-bed4-1f9b138de589', '9127a307-2100-45ad-9f68-7c4f6b718a3d', 2026, 120, 0, 0, 120, 0, 0, NULL, '2026-05-03 10:02:22.883', '2026-05-03 10:02:22.883', 0, 0),
  ('40a13d7b-3ffe-46c9-845a-ca9d77e91ff0', 'df7822fd-6d6c-4a59-bed4-1f9b138de589', '8981bc0c-34c5-4fc0-bdbe-5d2319ffbfb7', 2026, 0, 0, 0, 0, 0, 0, NULL, '2026-05-03 10:02:22.885', '2026-05-03 10:02:22.885', 0, 0),
  ('67abf364-38a4-4dff-8d36-3eadfafde344', 'df7822fd-6d6c-4a59-bed4-1f9b138de589', 'b4a76632-ed2c-4248-aab8-3b90e8756ee9', 2026, 3, 0, 0, 3, 0, 0, NULL, '2026-05-03 10:02:22.888', '2026-05-03 10:02:22.888', 0, 0),
  ('fc7088a4-36f1-4c14-9c64-6bbbcb7b0d58', 'df7822fd-6d6c-4a59-bed4-1f9b138de589', '7d568a69-853b-4657-a624-371b0c7102dd', 2026, 0, 0, 0, 0, 0, 0, NULL, '2026-05-03 10:02:22.89', '2026-05-03 10:02:22.89', 0, 0),
  ('b3ac5ec3-27f2-47ce-9348-04522a4e7cca', '2adda9f1-a53a-4f89-b512-3ca86133b0a6', '345c3487-4ecc-4750-b58a-fafae3d90790', 2026, 10.5, 0, 0, 10.5, 0, 0, NULL, '2026-05-02 11:33:28.258', '2026-05-02 11:33:28.258', 0, 0),
  ('893e9c72-8597-4570-8388-868c8f0d623c', '2adda9f1-a53a-4f89-b512-3ca86133b0a6', 'e3569b41-5fd2-445b-8a11-c1bc6da94486', 2026, 180, 0, 0, 180, 0, 0, NULL, '2026-05-02 11:33:28.264', '2026-05-02 11:33:28.264', 0, 0),
  ('ae049f50-9d2d-448c-93a0-152a02f0d5dd', '2adda9f1-a53a-4f89-b512-3ca86133b0a6', '619f88d4-8381-47c6-8645-7a7feb28f660', 2026, 5, 0, 0, 5, 0, 0, NULL, '2026-05-02 11:33:28.267', '2026-05-02 11:33:28.267', 0, 0),
  ('88804376-34a5-49a0-abfc-f3898a577624', '2adda9f1-a53a-4f89-b512-3ca86133b0a6', '75ae7b48-cf57-406c-91dc-1087649c4b6e', 2026, 7, 0, 0, 7, 0, 0, NULL, '2026-05-02 11:33:28.271', '2026-05-02 11:33:28.271', 0, 0),
  ('48f0a1e4-baff-4207-b5f3-e8d8ddcad291', '2adda9f1-a53a-4f89-b512-3ca86133b0a6', '645b4b22-d030-48f3-bbd5-f5f4cbe2bbfe', 2026, 5, 0, 0, 5, 0, 0, NULL, '2026-05-02 11:33:28.274', '2026-05-02 11:33:28.274', 0, 0),
  ('cdc232b9-ba85-41e8-b745-6616e75fcc7d', '2adda9f1-a53a-4f89-b512-3ca86133b0a6', '1293555a-3fcd-46cc-bcc1-07150c555308', 2026, 0, 0, 0, 0, 0, 0, NULL, '2026-05-02 11:33:28.278', '2026-05-02 11:33:28.278', 0, 0),
  ('541aece2-9400-45e5-8870-b03f87c4316d', '2adda9f1-a53a-4f89-b512-3ca86133b0a6', '6f06298d-bf8a-450b-915a-0835884c456d', 2026, 30, 0, 0, 30, 0, 0, NULL, '2026-05-02 11:33:28.281', '2026-05-02 11:33:28.281', 0, 0),
  ('afb701a3-e2a7-4635-968b-8e996c01347b', '2adda9f1-a53a-4f89-b512-3ca86133b0a6', '0c66e192-f012-4df0-9029-93b9dcdc2747', 2026, 10, 0, 0, 10, 0, 0, NULL, '2026-05-02 11:33:28.284', '2026-05-02 11:33:28.284', 0, 0),
  ('ff6d898b-afd9-4ccd-9f5c-32cdde02eb75', '2adda9f1-a53a-4f89-b512-3ca86133b0a6', '5aa454f2-570d-4cf5-a0ae-86fdf754f1ee', 2026, 0, 0, 0, 0, 0, 0, NULL, '2026-05-02 11:33:28.287', '2026-05-02 11:33:28.287', 0, 0),
  ('c7ae81ea-2ffa-4d26-a94f-b5f7673743e9', '2adda9f1-a53a-4f89-b512-3ca86133b0a6', '9127a307-2100-45ad-9f68-7c4f6b718a3d', 2026, 120, 0, 0, 120, 0, 0, NULL, '2026-05-02 11:33:28.29', '2026-05-02 11:33:28.29', 0, 0),
  ('66c1afa2-ef0c-456b-ae3c-51f4b9d13d36', '2adda9f1-a53a-4f89-b512-3ca86133b0a6', '8981bc0c-34c5-4fc0-bdbe-5d2319ffbfb7', 2026, 0, 0, 0, 0, 0, 0, NULL, '2026-05-02 11:33:28.293', '2026-05-02 11:33:28.293', 0, 0),
  ('58865ff7-3350-4592-81df-cd24d0bc7740', '2adda9f1-a53a-4f89-b512-3ca86133b0a6', 'b4a76632-ed2c-4248-aab8-3b90e8756ee9', 2026, 3, 0, 0, 3, 0, 0, NULL, '2026-05-02 11:33:28.296', '2026-05-02 11:33:28.296', 0, 0),
  ('ed27a79e-9d1c-4777-a3b0-833e0051ec58', '2adda9f1-a53a-4f89-b512-3ca86133b0a6', '7d568a69-853b-4657-a624-371b0c7102dd', 2026, 0, 0, 0, 0, 0, 0, NULL, '2026-05-02 11:33:28.299', '2026-05-02 11:33:28.299', 0, 0)
ON CONFLICT DO NOTHING;
  `);

  console.log('leave seeding done.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
