CREATE TYPE "EquipmentServiceOutcome" AS ENUM ('COMPLETED','FAILED');
CREATE TABLE "EquipmentServiceRecord" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "equipmentId" uuid NOT NULL,
  "servicedAt" timestamptz(3) NOT NULL,
  "provider" text,
  "description" text NOT NULL,
  "outcome" "EquipmentServiceOutcome" NOT NULL,
  "evidenceFileId" uuid,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EquipmentServiceRecord_equipment_fkey" FOREIGN KEY ("organizationId","equipmentId") REFERENCES "Equipment"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "EquipmentServiceRecord_evidence_fkey" FOREIGN KEY ("organizationId","evidenceFileId") REFERENCES "FileObject"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "EquipmentServiceRecord_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "EquipmentServiceRecord_description_check" CHECK (length(btrim("description"))>0)
);
CREATE INDEX "EquipmentServiceRecord_org_equipment_idx" ON "EquipmentServiceRecord"("organizationId","equipmentId","servicedAt" DESC);
CREATE OR REPLACE FUNCTION reject_equipment_service_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'EquipmentServiceRecord is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "EquipmentServiceRecord_append_only" BEFORE UPDATE OR DELETE ON "EquipmentServiceRecord" FOR EACH ROW EXECUTE FUNCTION reject_equipment_service_mutation();
