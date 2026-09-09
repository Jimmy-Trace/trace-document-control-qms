CREATE TABLE "IntegrationAccessEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "integrationClientId" uuid NOT NULL,
  "resource" text NOT NULL,
  "operation" text NOT NULL,
  "recordCount" integer NOT NULL DEFAULT 0,
  "accessedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationAccessEvent_client_fkey" FOREIGN KEY ("organizationId","integrationClientId") REFERENCES "IntegrationClient"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "IntegrationAccessEvent_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "IntegrationAccessEvent_resource_check" CHECK (length(btrim("resource")) > 0),
  CONSTRAINT "IntegrationAccessEvent_operation_check" CHECK (length(btrim("operation")) > 0),
  CONSTRAINT "IntegrationAccessEvent_record_count_check" CHECK ("recordCount" >= 0)
);

CREATE INDEX "IntegrationAccessEvent_org_client_idx" ON "IntegrationAccessEvent"("organizationId","integrationClientId","accessedAt" DESC);
CREATE INDEX "IntegrationAccessEvent_org_resource_idx" ON "IntegrationAccessEvent"("organizationId","resource","accessedAt" DESC);

CREATE OR REPLACE FUNCTION reject_integration_access_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Integration access evidence is append-only';
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER "IntegrationAccessEvent_append_only"
BEFORE UPDATE OR DELETE ON "IntegrationAccessEvent"
FOR EACH ROW EXECUTE FUNCTION reject_integration_access_event_mutation();
