CREATE TABLE referrals.referral_specialties (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "isCustom"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "referral_specialties_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "referral_specialties_name_key" UNIQUE ("name")
);

INSERT INTO referrals.referral_specialties ("id", "name", "isCustom") VALUES
  (gen_random_uuid()::text, 'طب عام', false),
  (gen_random_uuid()::text, 'جراحة عظام', false),
  (gen_random_uuid()::text, 'أطراف صناعية', false),
  (gen_random_uuid()::text, 'علاج طبيعي', false),
  (gen_random_uuid()::text, 'طب القدم', false),
  (gen_random_uuid()::text, 'جراحة عامة', false),
  (gen_random_uuid()::text, 'أعصاب', false),
  (gen_random_uuid()::text, 'روماتيزم', false),
  (gen_random_uuid()::text, 'داخلية', false),
  (gen_random_uuid()::text, 'أطفال', false),
  (gen_random_uuid()::text, 'جلدية', false),
  (gen_random_uuid()::text, 'قلب وأوعية', false);
