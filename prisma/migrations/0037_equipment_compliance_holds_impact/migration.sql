CREATE TYPE "EquipmentComplianceKind" AS ENUM ('CALIBRATION_OVERDUE','MAINTENANCE_OVERDUE');
CREATE TYPE "EquipmentImpactDisposition" AS ENUM ('NO_IMPACT','POTENTIAL_IMPACT','CONFIRMED_IMPACT');

CREATE TABLE "EquipmentComplianceHold" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "equipmentId" uuid NOT NULL,
  "kind" "EquipmentComplianceKind" NOT NULL,
  "dueAt" date NOT NULL,
  "detectedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "clearedAt" timestamptz(3),
  "clearedByUserId" uuid,
  "clearanceReason" text,
  CONSTRAINT "EquipmentComplianceHold_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EquipmentComplianceHold_equipment_fkey" FOREIGN KEY ("organizationId","equipmentId") REFERENCES "Equipment"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EquipmentComplianceHold_clearer_fkey" FOREIGN KEY ("organizationId","clearedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EquipmentComplianceHold_unique" UNIQUE ("organizationId","equipmentId","kind","dueAt"),
  CONSTRAINT "EquipmentComplianceHold_clearance_check" CHECK (("clearedAt" IS NULL AND "clearedByUserId" IS NULL AND "clearanceReason" IS NULL) OR ("clearedAt" IS NOT NULL AND "clearedByUserId" IS NOT NULL AND length(btrim("clearanceReason")) > 0))
);
CREATE INDEX "EquipmentComplianceHold_active_idx" ON "EquipmentComplianceHold"("organizationId","equipmentId") WHERE "clearedAt" IS NULL;

CREATE TABLE "EquipmentImpactAssessment" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "equipmentId" uuid NOT NULL,
  "holdId" uuid,
  "disposition" "EquipmentImpactDisposition" NOT NULL,
  "scopeSummary" text NOT NULL,
  "rationale" text NOT NULL,
  "qualityEventId" uuid,
  "assessedByUserId" uuid NOT NULL,
  "assessedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EquipmentImpactAssessment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EquipmentImpactAssessment_equipment_fkey" FOREIGN KEY ("organizationId","equipmentId") REFERENCES "Equipment"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EquipmentImpactAssessment_hold_fkey" FOREIGN KEY ("holdId") REFERENCES "EquipmentComplianceHold"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EquipmentImpactAssessment_quality_event_fkey" FOREIGN KEY ("organizationId","qualityEventId") REFERENCES "QualityEvent"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EquipmentImpactAssessment_assessor_fkey" FOREIGN KEY ("organizationId","assessedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EquipmentImpactAssessment_scope_check" CHECK (length(btrim("scopeSummary")) > 0),
  CONSTRAINT "EquipmentImpactAssessment_rationale_check" CHECK (length(btrim("rationale")) > 0)
);
CREATE INDEX "EquipmentImpactAssessment_org_equipment_idx" ON "EquipmentImpactAssessment"("organizationId","equipmentId","assessedAt" DESC);

CREATE OR REPLACE FUNCTION reject_equipment_impact_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'EquipmentImpactAssessment is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "EquipmentImpactAssessment_append_only" BEFORE UPDATE OR DELETE ON "EquipmentImpactAssessment" FOR EACH ROW EXECUTE FUNCTION reject_equipment_impact_mutation();
