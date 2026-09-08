CREATE TYPE "EquipmentRecallStatus" AS ENUM ('OPEN','CLOSED');
CREATE TABLE "EquipmentRecall" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "equipmentId" uuid NOT NULL,
  "reason" text NOT NULL,
  "scopeSummary" text NOT NULL,
  "openedByUserId" uuid NOT NULL,
  "openedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "EquipmentRecallStatus" NOT NULL DEFAULT 'OPEN',
  "closedByUserId" uuid,
  "closedAt" timestamptz(3),
  "closureReason" text,
  CONSTRAINT "EquipmentRecall_equipment_fkey" FOREIGN KEY ("organizationId","equipmentId") REFERENCES "Equipment"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "EquipmentRecall_opener_fkey" FOREIGN KEY ("organizationId","openedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "EquipmentRecall_closer_fkey" FOREIGN KEY ("organizationId","closedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "EquipmentRecall_reason_check" CHECK (length(btrim("reason"))>0),
  CONSTRAINT "EquipmentRecall_scope_check" CHECK (length(btrim("scopeSummary"))>0),
  CONSTRAINT "EquipmentRecall_closure_check" CHECK (("status"='OPEN' AND "closedAt" IS NULL AND "closedByUserId" IS NULL AND "closureReason" IS NULL) OR ("status"='CLOSED' AND "closedAt" IS NOT NULL AND "closedByUserId" IS NOT NULL AND length(btrim("closureReason"))>0))
);
CREATE UNIQUE INDEX "EquipmentRecall_one_open" ON "EquipmentRecall"("organizationId","equipmentId") WHERE "status"='OPEN';
CREATE INDEX "EquipmentRecall_org_status_idx" ON "EquipmentRecall"("organizationId","status","openedAt" DESC);

CREATE TABLE "EquipmentQuarantineEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "equipmentId" uuid NOT NULL,
  "recallId" uuid NOT NULL,
  "action" text NOT NULL,
  "reason" text NOT NULL,
  "actorUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EquipmentQuarantineEvent_equipment_fkey" FOREIGN KEY ("organizationId","equipmentId") REFERENCES "Equipment"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "EquipmentQuarantineEvent_recall_fkey" FOREIGN KEY ("recallId") REFERENCES "EquipmentRecall"("id") ON DELETE RESTRICT,
  CONSTRAINT "EquipmentQuarantineEvent_actor_fkey" FOREIGN KEY ("organizationId","actorUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "EquipmentQuarantineEvent_action_check" CHECK ("action" IN ('QUARANTINED','RELEASED')),
  CONSTRAINT "EquipmentQuarantineEvent_reason_check" CHECK (length(btrim("reason"))>0)
);
CREATE INDEX "EquipmentQuarantineEvent_org_equipment_idx" ON "EquipmentQuarantineEvent"("organizationId","equipmentId","createdAt" DESC);
CREATE OR REPLACE FUNCTION reject_equipment_quarantine_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'EquipmentQuarantineEvent is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "EquipmentQuarantineEvent_append_only" BEFORE UPDATE OR DELETE ON "EquipmentQuarantineEvent" FOR EACH ROW EXECUTE FUNCTION reject_equipment_quarantine_mutation();
