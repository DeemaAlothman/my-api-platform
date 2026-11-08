-- جدول جديد بالكامل + نوعين enum جديدين — صفر تأثير على أي جدول أو بيانات موجودة فعلياً
CREATE TYPE "referrals"."CustomerGender" AS ENUM ('MALE', 'FEMALE');
CREATE TYPE "referrals"."CustomerArrivalMethod" AS ENUM ('HOSPITAL', 'FRIEND', 'DOCTOR', 'STAFF', 'SOCIAL_MEDIA');

CREATE TABLE "referrals"."customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" "referrals"."CustomerGender" NOT NULL,
    "age" INTEGER,
    "arrivalMethod" "referrals"."CustomerArrivalMethod",
    "contactNumber" TEXT NOT NULL,
    "residence" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);
