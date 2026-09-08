CREATE TYPE "MaterialRecallImpactDisposition" AS ENUM ('NO_IMPACT','POTENTIAL_IMPACT','CONFIRMED_IMPACT');

ALTER TABLE "MaterialRecallImpact" ADD COLUMN "disposition" "MaterialRecallImpactDisposition";
ALTER TABLE "MaterialRecallImpact" ADD COLUMN "dispositionReason" text;
ALTER TABLE "MaterialRecallImpact" ADD COLUMN "disposedByUserId" uuid;
ALTER TABLE "MaterialRecallImpact" ADD COLUMN "disposedAt" timestamptz(3);
ALTER TABLE "MaterialRecallImpact" ADD COLUMN "closedAt" timestamptz(3);
ALTER TABLE "MaterialRecallImpact" ADD COLUMN "closedByUserId" uuid;
ALTER TABLE "MaterialRecallImpact" ADD COLUMN "closureReason" text;
ALTER TABLE "MaterialRecallImpact" ADD CONSTRAINT "MaterialRecallImpact_disposer_fkey" FOREIGN KEY ("organizationId","disposedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT;
ALTER TABLE "MaterialRecallImpact" ADD CONSTRAINT "MaterialRecallImpact_closer_fkey" FOREIGN KEY ("organizationId","closedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT;

CREATE TABLE "MaterialRecallEscalationEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "materialRecallId" uuid NOT NULL,
  "level" integer NOT NULL,
  "eventKey" text NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaterialRecallEscalationEvent_recall_fkey" FOREIGN KEY ("organizationId","materialRecallId") REFERENCES "MaterialRecall"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "MaterialRecallEscalationEvent_level_check" CHECK ("level" IN (1,7,30)),
  CONSTRAINT "MaterialRecallEscalationEvent_key_unique" UNIQUE ("organizationId","eventKey")
);
CREATE INDEX "MaterialRecallEscalationEvent_org_recall_idx" ON "MaterialRecallEscalationEvent"("organizationId","materialRecallId","createdAt" DESC);

CREATE OR REPLACE FUNCTION reject_material_recall_escalation_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'MaterialRecallEscalationEvent is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "MaterialRecallEscalationEvent_append_only" BEFORE UPDATE OR DELETE ON "MaterialRecallEscalationEvent" FOR EACH ROW EXECUTE FUNCTION reject_material_recall_escalation_mutation();
