CREATE TYPE "MaterialStatus" AS ENUM ('ACTIVE','INACTIVE');
CREATE TYPE "MaterialLotStatus" AS ENUM ('RECEIVED','ACCEPTED','QUARANTINED','REJECTED','EXPIRED','RECALLED','DEPLETED');

CREATE TABLE "Material" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "materialNumber" text NOT NULL,
  "name" text NOT NULL,
  "manufacturer" text,
  "catalogNumber" text,
  "description" text,
  "status" "MaterialStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Material_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Material_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "Material_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "Material_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "Material_org_number_key" UNIQUE ("organizationId","materialNumber"),
  CONSTRAINT "Material_number_not_blank" CHECK (length(btrim("materialNumber"))>0),
  CONSTRAINT "Material_name_not_blank" CHECK (length(btrim("name"))>0)
);

CREATE TABLE "MaterialLot" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "materialId" uuid NOT NULL,
  "lotNumber" text NOT NULL,
  "status" "MaterialLotStatus" NOT NULL DEFAULT 'RECEIVED',
  "receivedAt" date NOT NULL,
  "expirationDate" date,
  "quantityReceived" numeric(18,4),
  "unitOfMeasure" text,
  "siteId" uuid,
  "departmentId" uuid,
  "evidenceFileId" uuid,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaterialLot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MaterialLot_material_fkey" FOREIGN KEY ("organizationId","materialId") REFERENCES "Material"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "MaterialLot_site_fkey" FOREIGN KEY ("organizationId","siteId") REFERENCES "Site"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "MaterialLot_department_fkey" FOREIGN KEY ("organizationId","departmentId") REFERENCES "Department"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "MaterialLot_evidence_fkey" FOREIGN KEY ("organizationId","evidenceFileId") REFERENCES "FileObject"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "MaterialLot_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "MaterialLot_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "MaterialLot_org_material_lot_key" UNIQUE ("organizationId","materialId","lotNumber"),
  CONSTRAINT "MaterialLot_number_not_blank" CHECK (length(btrim("lotNumber"))>0),
  CONSTRAINT "MaterialLot_quantity_check" CHECK ("quantityReceived" IS NULL OR "quantityReceived">=0),
  CONSTRAINT "MaterialLot_uom_check" CHECK (("quantityReceived" IS NULL AND "unitOfMeasure" IS NULL) OR ("quantityReceived" IS NOT NULL AND length(btrim("unitOfMeasure"))>0))
);

CREATE TABLE "MaterialLotStatusChange" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "materialLotId" uuid NOT NULL,
  "fromStatus" "MaterialLotStatus" NOT NULL,
  "toStatus" "MaterialLotStatus" NOT NULL,
  "reason" text NOT NULL,
  "actorUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaterialLotStatusChange_lot_fkey" FOREIGN KEY ("organizationId","materialLotId") REFERENCES "MaterialLot"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "MaterialLotStatusChange_actor_fkey" FOREIGN KEY ("organizationId","actorUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "MaterialLotStatusChange_reason_not_blank" CHECK (length(btrim("reason"))>0)
);

CREATE INDEX "Material_org_status_idx" ON "Material"("organizationId","status");
CREATE INDEX "MaterialLot_org_status_idx" ON "MaterialLot"("organizationId","status");
CREATE INDEX "MaterialLot_org_expiration_idx" ON "MaterialLot"("organizationId","expirationDate");
CREATE INDEX "MaterialLot_org_site_department_idx" ON "MaterialLot"("organizationId","siteId","departmentId");
CREATE INDEX "MaterialLotStatusChange_org_lot_idx" ON "MaterialLotStatusChange"("organizationId","materialLotId","createdAt" DESC);

CREATE OR REPLACE FUNCTION reject_material_lot_status_change_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'MaterialLotStatusChange is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "MaterialLotStatusChange_append_only" BEFORE UPDATE OR DELETE ON "MaterialLotStatusChange" FOR EACH ROW EXECUTE FUNCTION reject_material_lot_status_change_mutation();

INSERT INTO "Permission" ("id","key","description") VALUES
  (gen_random_uuid(),'inventory.read','View governed materials and lots'),
  (gen_random_uuid(),'inventory.manage','Create and manage governed materials and lots')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."systemRole"=true AND r."name"='System Administrator' AND p."key" IN ('inventory.read','inventory.manage')
ON CONFLICT ("roleId","permissionId") DO NOTHING;