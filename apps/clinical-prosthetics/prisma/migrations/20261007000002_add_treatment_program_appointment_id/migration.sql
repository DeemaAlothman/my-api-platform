-- معرّف الموعد لجلسات برنامج العلاج المنشأة من موعد — عمود جديد اختياري فقط، لا يتغير أي سجل موجود
ALTER TABLE "clinic_prosthetics"."case_treatment_programs" ADD COLUMN "appointmentId" TEXT;
