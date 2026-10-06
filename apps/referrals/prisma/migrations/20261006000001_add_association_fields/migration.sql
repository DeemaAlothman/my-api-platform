-- حقول الجمعيات: أعمدة جديدة اختيارية فقط، لا يتغير أي عمود أو سجل موجود
ALTER TABLE "referrals"."referral_sources" ADD COLUMN "projectName" TEXT;
ALTER TABLE "referrals"."referral_sources" ADD COLUMN "supportingEntity" TEXT;
ALTER TABLE "referrals"."referral_sources" ADD COLUMN "contractDate" TIMESTAMP(3);
ALTER TABLE "referrals"."referral_sources" ADD COLUMN "activationDate" TIMESTAMP(3);
ALTER TABLE "referrals"."referral_sources" ADD COLUMN "contractEndDate" TIMESTAMP(3);
