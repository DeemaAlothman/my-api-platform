-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "biometric";

-- CreateTable
CREATE TABLE "biometric"."biometric_devices" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "location" TEXT,
    "ipAddress" TEXT,
    "model" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "apiKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "biometric_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biometric"."employee_fingerprints" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_fingerprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biometric"."raw_attendance_logs" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceSN" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "employeeId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "rawType" INTEGER NOT NULL DEFAULT 0,
    "interpretedAs" TEXT,
    "pairIndex" INTEGER,
    "synced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),
    "syncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_attendance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "biometric_devices_serialNumber_key" ON "biometric"."biometric_devices"("serialNumber");
CREATE UNIQUE INDEX "biometric_devices_apiKey_key" ON "biometric"."biometric_devices"("apiKey");
CREATE INDEX "employee_fingerprints_employeeId_idx" ON "biometric"."employee_fingerprints"("employeeId");
CREATE UNIQUE INDEX "employee_fingerprints_pin_deviceId_key" ON "biometric"."employee_fingerprints"("pin", "deviceId");
CREATE INDEX "raw_attendance_logs_deviceSN_pin_timestamp_idx" ON "biometric"."raw_attendance_logs"("deviceSN", "pin", "timestamp");
CREATE INDEX "raw_attendance_logs_employeeId_timestamp_idx" ON "biometric"."raw_attendance_logs"("employeeId", "timestamp");
CREATE INDEX "raw_attendance_logs_synced_idx" ON "biometric"."raw_attendance_logs"("synced");

-- AddForeignKey
ALTER TABLE "biometric"."employee_fingerprints" ADD CONSTRAINT "employee_fingerprints_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "biometric"."biometric_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biometric"."raw_attendance_logs" ADD CONSTRAINT "raw_attendance_logs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "biometric"."biometric_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
