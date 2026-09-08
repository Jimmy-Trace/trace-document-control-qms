CREATE TYPE "EquipmentStatus" AS ENUM ('PLANNED','ACTIVE','OUT_OF_SERVICE','RETIRED');
CREATE TYPE "EquipmentEventType" AS ENUM ('RECEIVED','QUALIFIED','CALIBRATED','MAINTENANCE','SERVICE','OUT_OF_SERVICE','RETURNED_TO_SERVICE','RETIRED');

CREATE TABLE "Equipment" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "equipmentNumber" text NOT NULL,
  "name" text NOT NULL,
  "manufacturer" text,
  "model" text,
  "serialNumber" text,
  "siteId" uuid,
  "departmentId" uuid,
  "status" "EquipmentStatus" NOT NULL DEFAULT 'PLANNED',
  "receivedAt" date,
  "placedInServiceAt" date,
  "calibrationRequired" boolean NOT NULL DEFAULT false,
  "calibrationIntervalDays" integer,
  "nextCalibrationDueAt" date,
  "maintenanceRequired" boolean NOT NULL DEFAULT false,
  "maintenanceIntervalDays" integer,
  "nextMaintenanceDueAt" date,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Equipment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Equipment_site_fkey" FOREIGN KEY ("organizationId","siteId") REFERENCES "Site"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Equipment_department_fkey" FOREIGN KEY ("organizationId","departmentId") REFERENCES "Department"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Equipment_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Equipment_organizationId_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "Equipment_organizationId_equipmentNumber_key" UNIQUE ("organizationId","equipmentNumber"),
  CONSTRAINT "Equipment_number_not_blank" CHECK (length(btrim("equipmentNumber")) > 0),
  CONSTRAINT "Equipment_name_not_blank" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "Equipment_calibration_interval_check" CHECK ((NOT "calibrationRequired" AND "calibrationIntervalDays" IS NULL AND "nextCalibrationDueAt" IS NULL) OR ("calibrationRequired" AND "calibrationIntervalDays" > 0)),
  CONSTRAINT "Equipment_maintenance_interval_check" CHECK ((NOT "maintenanceRequired" AND "maintenanceIntervalDays" IS NULL AND "nextMaintenanceDueAt" IS NULL) OR ("maintenanceRequired" AND "maintenanceIntervalDays" > 0))
);

CREATE TABLE "EquipmentEvent" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "equipmentId" uuid NOT NULL,
  "eventType" "EquipmentEventType" NOT NULL,
  "occurredAt" timestamptz(3) NOT NULL,
  "summary" text NOT NULL,
  "evidenceFileId" uuid,
  "performedByUserId" uuid,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EquipmentEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EquipmentEvent_equipment_fkey" FOREIGN KEY ("organizationId","equipmentId") REFERENCES "Equipment"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EquipmentEvent_evidence_fkey" FOREIGN KEY ("organizationId","evidenceFileId") REFERENCES "FileObject"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EquipmentEvent_performer_fkey" FOREIGN KEY ("organizationId","performedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EquipmentEvent_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EquipmentEvent_summary_not_blank" CHECK (length(btrim("summary")) > 0)
);

CREATE INDEX "Equipment_org_status_idx" ON "Equipment"("organizationId","status");
CREATE INDEX "Equipment_org_site_department_idx" ON "Equipment"("organizationId","siteId","departmentId");
CREATE INDEX "Equipment_calibration_due_idx" ON "Equipment"("organizationId","nextCalibrationDueAt") WHERE "status"='ACTIVE' AND "calibrationRequired"=true;
CREATE INDEX "Equipment_maintenance_due_idx" ON "Equipment"("organizationId","nextMaintenanceDueAt") WHERE "status"='ACTIVE' AND "maintenanceRequired"=true;
CREATE INDEX "EquipmentEvent_org_equipment_occurred_idx" ON "EquipmentEvent"("organizationId","equipmentId","occurredAt" DESC);

CREATE OR REPLACE FUNCTION reject_equipment_event_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'EquipmentEvent is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "EquipmentEvent_append_only" BEFORE UPDATE OR DELETE ON "EquipmentEvent" FOR EACH ROW EXECUTE FUNCTION reject_equipment_event_mutation();

INSERT INTO "Permission" ("id","key","description") VALUES
  (gen_random_uuid(),'equipment.read','View governed equipment records'),
  (gen_random_uuid(),'equipment.manage','Create and manage governed equipment records')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."systemRole"=true AND r."name"='System Administrator' AND p."key" IN ('equipment.read','equipment.manage')
ON CONFLICT ("roleId","permissionId") DO NOTHING;
