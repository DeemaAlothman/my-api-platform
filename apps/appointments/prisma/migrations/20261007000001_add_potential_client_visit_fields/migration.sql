-- العملاء المحتملين: زار المركز / استفاد بدفع فعلي — عمودان جديدان اختياريان فقط، لا يتغير أي سجل موجود
ALTER TABLE "clinic_appointments"."potential_clients" ADD COLUMN "visitedCenter" BOOLEAN;
ALTER TABLE "clinic_appointments"."potential_clients" ADD COLUMN "paidVisit" BOOLEAN;
