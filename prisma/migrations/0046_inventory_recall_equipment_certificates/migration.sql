CREATE TABLE "MaterialLotAcceptanceCertificate" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "materialLotId" uuid NOT NULL,
  "evidenceFileId" uuid NOT NULL,
  "summary" text NOT NULL,
  "acceptedByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaterialLotAcceptanceCertificate_lot_fkey" FOREIGN KEY ("organizationId","materialLotId") REFERENCES "MaterialLot"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "MaterialLotAcceptanceCertificate_file_fkey" FOREIGN KEY ("organizationId","evidenceFileId") REFERENCES "FileObject"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "MaterialLotAcceptanceCertificate_actor_fkey" FOREIGN KEY ("organizationId","acceptedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "MaterialLotAcceptanceCertificate_lot_unique" UNIQUE ("organizationId","materialLotId"),
  CONSTRAINT "MaterialLotAcceptanceCertificate_summary_check" CHECK (length(btrim("summary"))>0)
);

CREATE TABLE "MaterialLotEquipmentUse" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "materialLotId" uuid NOT NULL,
  "equipmentId" uuid NOT NULL,
  "referenceType" text NOT NULL,
  "referenceId" text NOT NULL,
  "quantityUsed" numeric(18,4),
  "unitOfMeasure" text,
  "usedAt" timestamptz(3) NOT NULL,
  "actorUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaterialLotEquipmentUse_lot_fkey" FOREIGN KEY ("organizationId","materialLotId") REFERENCES "MaterialLot"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "MaterialLotEquipmentUse_equipment_fkey" FOREIGN KEY ("organizationId","equipmentId") REFERENCES "Equipment"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "MaterialLotEquipmentUse_actor_fkey" FOREIGN KEY ("organizationId","actorUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "MaterialLotEquipmentUse_qty_check" CHECK ("quantityUsed" IS NULL OR "quantityUsed">0),
  CONSTRAINT "MaterialLotEquipmentUse_uom_check" CHECK (("quantityUsed" IS NULL AND "unitOfMeasure" IS NULL) OR ("quantityUsed" IS NOT NULL AND length(btrim("unitOfMeasure"))>0)),
  CONSTRAINT "MaterialLotEquipmentUse_reference_unique" UNIQUE ("organizationId","referenceType","referenceId","materialLotId","equipmentId")
);
CREATE INDEX "MaterialLotEquipmentUse_org_lot_idx" ON "MaterialLotEquipmentUse"("organizationId","materialLotId","usedAt" DESC);
CREATE INDEX "MaterialLotEquipmentUse_org_equipment_idx" ON "MaterialLotEquipmentUse"("organizationId","equipmentId","usedAt" DESC);

CREATE TABLE "MaterialRecall" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "manufacturer" text NOT NULL,
  "externalReference" text NOT NULL,
  "reason" text NOT NULL,
  "evidenceFileId" uuid,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaterialRecall_file_fkey" FOREIGN KEY ("organizationId","evidenceFileId") REFERENCES "FileObject"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "MaterialRecall_actor_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "MaterialRecall_reference_unique" UNIQUE ("organizationId","externalReference"),
  CONSTRAINT "MaterialRecall_reason_check" CHECK (length(btrim("reason"))>0)
);

CREATE TABLE "MaterialRecallLot" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "materialRecallId" uuid NOT NULL,
  "materialLotId" uuid NOT NULL,
  "previousStatus" "MaterialLotStatus" NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaterialRecallLot_recall_fkey" FOREIGN KEY ("materialRecallId") REFERENCES "MaterialRecall"("id") ON DELETE RESTRICT,
  CONSTRAINT "MaterialRecallLot_lot_fkey" FOREIGN KEY ("organizationId","materialLotId") REFERENCES "MaterialLot"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "MaterialRecallLot_unique" UNIQUE ("organizationId","materialRecallId","materialLotId")
);

CREATE OR REPLACE FUNCTION reject_inventory_trace_evidence_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Inventory trace evidence is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "MaterialLotAcceptanceCertificate_append_only" BEFORE UPDATE OR DELETE ON "MaterialLotAcceptanceCertificate" FOR EACH ROW EXECUTE FUNCTION reject_inventory_trace_evidence_mutation();
CREATE TRIGGER "MaterialLotEquipmentUse_append_only" BEFORE UPDATE OR DELETE ON "MaterialLotEquipmentUse" FOR EACH ROW EXECUTE FUNCTION reject_inventory_trace_evidence_mutation();
CREATE TRIGGER "MaterialRecall_append_only" BEFORE UPDATE OR DELETE ON "MaterialRecall" FOR EACH ROW EXECUTE FUNCTION reject_inventory_trace_evidence_mutation();
CREATE TRIGGER "MaterialRecallLot_append_only" BEFORE UPDATE OR DELETE ON "MaterialRecallLot" FOR EACH ROW EXECUTE FUNCTION reject_inventory_trace_evidence_mutation();