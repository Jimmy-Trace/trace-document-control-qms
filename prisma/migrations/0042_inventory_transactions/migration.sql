CREATE TYPE "InventoryTransactionType" AS ENUM ('RECEIPT','ADJUSTMENT_IN','ADJUSTMENT_OUT','CONSUMPTION','TRANSFER_IN','TRANSFER_OUT');

CREATE TABLE "InventoryTransaction" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "materialLotId" uuid NOT NULL,
  "transactionType" "InventoryTransactionType" NOT NULL,
  "quantity" numeric(18,4) NOT NULL,
  "unitOfMeasure" text NOT NULL,
  "siteId" uuid,
  "departmentId" uuid,
  "reason" text NOT NULL,
  "referenceKey" text,
  "actorUserId" uuid NOT NULL,
  "occurredAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryTransaction_lot_fkey" FOREIGN KEY ("organizationId","materialLotId") REFERENCES "MaterialLot"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "InventoryTransaction_site_fkey" FOREIGN KEY ("organizationId","siteId") REFERENCES "Site"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "InventoryTransaction_department_fkey" FOREIGN KEY ("organizationId","departmentId") REFERENCES "Department"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "InventoryTransaction_actor_fkey" FOREIGN KEY ("organizationId","actorUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "InventoryTransaction_quantity_check" CHECK ("quantity">0),
  CONSTRAINT "InventoryTransaction_uom_not_blank" CHECK (length(btrim("unitOfMeasure"))>0),
  CONSTRAINT "InventoryTransaction_reason_not_blank" CHECK (length(btrim("reason"))>0)
);
CREATE UNIQUE INDEX "InventoryTransaction_reference_unique" ON "InventoryTransaction"("organizationId","referenceKey") WHERE "referenceKey" IS NOT NULL;
CREATE INDEX "InventoryTransaction_org_lot_idx" ON "InventoryTransaction"("organizationId","materialLotId","occurredAt" DESC);
CREATE INDEX "InventoryTransaction_org_location_idx" ON "InventoryTransaction"("organizationId","siteId","departmentId","occurredAt" DESC);

CREATE TABLE "InventoryBalance" (
  "organizationId" uuid NOT NULL,
  "materialLotId" uuid NOT NULL,
  "siteId" uuid,
  "departmentId" uuid,
  "quantityOnHand" numeric(18,4) NOT NULL DEFAULT 0,
  "unitOfMeasure" text NOT NULL,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryBalance_lot_fkey" FOREIGN KEY ("organizationId","materialLotId") REFERENCES "MaterialLot"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "InventoryBalance_site_fkey" FOREIGN KEY ("organizationId","siteId") REFERENCES "Site"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "InventoryBalance_department_fkey" FOREIGN KEY ("organizationId","departmentId") REFERENCES "Department"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "InventoryBalance_quantity_nonnegative" CHECK ("quantityOnHand">=0),
  CONSTRAINT "InventoryBalance_uom_not_blank" CHECK (length(btrim("unitOfMeasure"))>0),
  CONSTRAINT "InventoryBalance_location_unique" UNIQUE NULLS NOT DISTINCT ("organizationId","materialLotId","siteId","departmentId")
);
CREATE INDEX "InventoryBalance_org_lot_idx" ON "InventoryBalance"("organizationId","materialLotId");
CREATE INDEX "InventoryBalance_org_location_idx" ON "InventoryBalance"("organizationId","siteId","departmentId");

CREATE OR REPLACE FUNCTION reject_inventory_transaction_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'InventoryTransaction is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "InventoryTransaction_append_only" BEFORE UPDATE OR DELETE ON "InventoryTransaction" FOR EACH ROW EXECUTE FUNCTION reject_inventory_transaction_mutation();