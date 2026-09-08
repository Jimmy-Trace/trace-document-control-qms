CREATE TABLE "QualityEventEscalation" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "eventId" uuid NOT NULL,
  "level" integer NOT NULL,
  "overdueDays" integer NOT NULL,
  "escalatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QualityEventEscalation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QualityEventEscalation_event_fkey" FOREIGN KEY ("organizationId", "eventId") REFERENCES "QualityEvent"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityEventEscalation_level_check" CHECK ("level" BETWEEN 1 AND 3),
  CONSTRAINT "QualityEventEscalation_overdue_days_check" CHECK ("overdueDays" >= 1),
  CONSTRAINT "QualityEventEscalation_once_key" UNIQUE ("organizationId", "eventId", "level")
);

CREATE INDEX "QualityEventEscalation_org_event_idx" ON "QualityEventEscalation"("organizationId", "eventId", "escalatedAt" DESC);

CREATE FUNCTION protect_quality_event_escalation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Quality event escalation evidence is append-only';
END;
$$;
CREATE TRIGGER "QualityEventEscalation_protect"
BEFORE UPDATE OR DELETE ON "QualityEventEscalation"
FOR EACH ROW EXECUTE FUNCTION protect_quality_event_escalation();
