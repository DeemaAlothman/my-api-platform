CREATE TABLE IF NOT EXISTS clinic_physio.physio_emergency_alerts (
  id              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "sentByUserId"  TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING',
  note            TEXT,
  "respondedAt"   TIMESTAMPTZ,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT physio_emergency_alerts_pkey PRIMARY KEY (id)
);
