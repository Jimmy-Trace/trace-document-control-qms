ALTER TABLE "EquipmentRecall" ALTER COLUMN "openedByUserId" DROP NOT NULL;
ALTER TABLE "EquipmentRecall" ADD COLUMN "sourceSystem" text;
ALTER TABLE "EquipmentRecall" ADD COLUMN "sourceKey" text;
ALTER TABLE "EquipmentRecall" ADD COLUMN "payloadHash" text;
ALTER TABLE "EquipmentRecall" ADD CONSTRAINT "EquipmentRecall_origin_check" CHECK (("openedByUserId" IS NOT NULL AND "sourceSystem" IS NULL AND "sourceKey" IS NULL AND "payloadHash" IS NULL) OR ("openedByUserId" IS NULL AND length(btrim("sourceSystem"))>0 AND length(btrim("sourceKey"))>0 AND length("payloadHash")=64));
CREATE UNIQUE INDEX "EquipmentRecall_system_source_key" ON "EquipmentRecall"("organizationId","sourceSystem","sourceKey") WHERE "sourceSystem" IS NOT NULL;

ALTER TABLE "EquipmentQuarantineEvent" ALTER COLUMN "actorUserId" DROP NOT NULL;

CREATE TYPE "EquipmentEscalationSubject" AS ENUM ('COMPLIANCE_HOLD','RECALL');
CREATE TABLE "EquipmentEscalation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "subjectType" "EquipmentEscalationSubject" NOT NULL,
  "subjectId" uuid NOT NULL,
  "equipmentId" uuid NOT NULL,
  "level" integer NOT NULL,
  "ageDays" integer NOT NULL,
  "escalatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EquipmentEscalation_equipment_fkey" FOREIGN KEY ("organizationId","equipmentId") REFERENCES "Equipment"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "EquipmentEscalation_level_check" CHECK ("level" IN (1,2,3)),
  CONSTRAINT "EquipmentEscalation_age_check" CHECK ("ageDays">=1),
  CONSTRAINT "EquipmentEscalation_unique" UNIQUE ("organizationId","subjectType","subjectId","level")
);
CREATE INDEX "EquipmentEscalation_org_equipment_idx" ON "EquipmentEscalation"("organizationId","equipmentId","escalatedAt" DESC);
CREATE OR REPLACE FUNCTION reject_equipment_escalation_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'EquipmentEscalation is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "EquipmentEscalation_append_only" BEFORE UPDATE OR DELETE ON "EquipmentEscalation" FOR EACH ROW EXECUTE FUNCTION reject_equipment_escalation_mutation();