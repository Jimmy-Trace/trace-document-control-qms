CREATE TABLE "QualityEventSystemTrigger" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "sourceSystem" text NOT NULL,
  "sourceKey" text NOT NULL,
  "eventId" uuid NOT NULL,
  "payloadHash" text NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QualityEventSystemTrigger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QualityEventSystemTrigger_event_fkey" FOREIGN KEY ("organizationId", "eventId") REFERENCES "QualityEvent"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityEventSystemTrigger_source_system_check" CHECK (length(btrim("sourceSystem")) > 0),
  CONSTRAINT "QualityEventSystemTrigger_source_key_check" CHECK (length(btrim("sourceKey")) > 0),
  CONSTRAINT "QualityEventSystemTrigger_payload_hash_check" CHECK (length("payloadHash") = 64),
  CONSTRAINT "QualityEventSystemTrigger_dedupe_key" UNIQUE ("organizationId", "sourceSystem", "sourceKey")
);

CREATE INDEX "QualityEventSystemTrigger_org_created_idx" ON "QualityEventSystemTrigger"("organizationId", "createdAt" DESC);

CREATE FUNCTION protect_quality_event_system_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Quality event system trigger evidence is append-only';
END;
$$;
CREATE TRIGGER "QualityEventSystemTrigger_protect"
BEFORE UPDATE OR DELETE ON "QualityEventSystemTrigger"
FOR EACH ROW EXECUTE FUNCTION protect_quality_event_system_trigger();
