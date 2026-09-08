CREATE TYPE "MaterialRecallImpactDisposition" AS ENUM ('NO_IMPACT','POTENTIAL_IMPACT','CONFIRMED_IMPACT');
CREATE TYPE "MaterialRecallImpactAction" AS ENUM ('DISPOSITION','CLOSURE');

ALTER TABLE "MaterialRecallImpact" ADD CONSTRAINT "MaterialRecallImpact_org_id_key" UNIQUE ("organizationId","id");

CREATE TABLE "MaterialRecallImpactActionEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "materialRecallImpactId" uuid NOT NULL,
  "action" "MaterialRecallImpactAction" NOT NULL,
  "disposition" "MaterialRecallImpactDisposition",
  "reason" text NOT NULL,
  "actorUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaterialRecallImpactActionEvent_impact_fkey" FOREIGN KEY ("organizationId","materialRecallImpactId") REFERENCES "MaterialRecallImpact"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "MaterialRecallImpactActionEvent_actor_fkey" FOREIGN KEY ("organizationId","actorUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "MaterialRecallImpactActionEvent_reason_check" CHECK (length(btrim("reason"))>0),
  CONSTRAINT "MaterialRecallImpactActionEvent_action_check" CHECK (("action"='DISPOSITION' AND "disposition" IS NOT NULL) OR ("action"='CLOSURE' AND "disposition" IS NULL))
);
CREATE INDEX "MaterialRecallImpactActionEvent_org_impact_idx" ON "MaterialRecallImpactActionEvent"("organizationId","materialRecallImpactId","createdAt" DESC);

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

CREATE OR REPLACE FUNCTION reject_material_recall_control_evidence_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Material recall control evidence is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "MaterialRecallImpactActionEvent_append_only" BEFORE UPDATE OR DELETE ON "MaterialRecallImpactActionEvent" FOR EACH ROW EXECUTE FUNCTION reject_material_recall_control_evidence_mutation();
CREATE TRIGGER "MaterialRecallEscalationEvent_append_only" BEFORE UPDATE OR DELETE ON "MaterialRecallEscalationEvent" FOR EACH ROW EXECUTE FUNCTION reject_material_recall_control_evidence_mutation();
