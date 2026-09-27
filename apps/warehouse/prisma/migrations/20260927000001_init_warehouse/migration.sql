CREATE SCHEMA IF NOT EXISTS "warehouse";

CREATE TABLE "warehouse"."warehouse_meta" (
    "id" SERIAL NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_meta_pkey" PRIMARY KEY ("id")
);

INSERT INTO "warehouse"."warehouse_meta" ("note") VALUES ('warehouse service initialized');
