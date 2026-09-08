CREATE TABLE "EquipmentStatusChange" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "equipmentId" uuid NOT NULL,
  "fromStatus" "EquipmentStatus" NOT NULL,
  "toStatus" "EquipmentStatus" NOT NULL,
  "reason" text NOT NULL,
  "actorUserId" uuid NOT NULL,
  "changedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EquipmentStatusChange_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EquipmentStatusChange_equipment_fkey" FOREIGN KEY ("organizationId","equipmentId") REFERENCES "Equipment"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EquipmentStatusChange_actor_fkey" FOREIGN KEY ("organizationId","actorUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EquipmentStatusChange_reason_not_blank" CHECK (length(btrim("reason")) > 0),
  CONSTRAINT "EquipmentStatusChange_status_changed" CHECK ("fromStatus" <> "toStatus")
);

CREATE INDEX "EquipmentStatusChange_org_equipment_changed_idx" ON "EquipmentStatusChange"("organizationId","equipmentId","changedAt" DESC);

CREATE OR REPLACE FUNCTION reject_equipment_status_change_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'EquipmentStatusChange is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "EquipmentStatusChange_append_only" BEFORE UPDATE OR DELETE ON "EquipmentStatusChange" FOR EACH ROW EXECUTE FUNCTION reject_equipment_status_change_mutation();
