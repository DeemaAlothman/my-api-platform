-- Pro-018: حقول ناقصة في التقييم النهائي
ALTER TABLE clinic_prosthetics.final_evaluations ADD COLUMN IF NOT EXISTS "departmentHeadOpinion" TEXT;
ALTER TABLE clinic_prosthetics.final_evaluations ADD COLUMN IF NOT EXISTS "medicalDirectorNotes"   TEXT;
