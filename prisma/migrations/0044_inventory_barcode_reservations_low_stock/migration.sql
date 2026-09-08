ALTER TABLE "MaterialLot" ADD COLUMN "barcodeValue" text;
CREATE UNIQUE INDEX "MaterialLot_org_barcode_unique" ON "MaterialLot"("organizationId","barcodeValue") WHERE "barcodeValue" IS NOT NULL;

CREATE TABLE "InventoryReservation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "materialLotId" uuid NOT NULL,
  "siteId" uuid,
  "departmentId" uuid,
  "quantity" numeric(18,4) NOT NULL,
  "unitOfMeasure" text NOT NULL,
  "referenceKey" text NOT NULL,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "reason" text NOT NULL,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" timestamptz(3),
  CONSTRAINT "InventoryReservation_lot_fkey" FOREIGN KEY ("organizationId","materialLotId") REFERENCES "MaterialLot"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "InventoryReservation_site_fkey" FOREIGN KEY ("organizationId","siteId") REFERENCES "Site"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "InventoryReservation_department_fkey" FOREIGN KEY ("organizationId","departmentId") REFERENCES "Department"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "InventoryReservation_actor_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "InventoryReservation_qty_check" CHECK ("quantity">0),
  CONSTRAINT "InventoryReservation_uom_check" CHECK (length(btrim("unitOfMeasure"))>0),
  CONSTRAINT "InventoryReservation_reason_check" CHECK (length(btrim("reason"))>0),
  CONSTRAINT "InventoryReservation_status_check" CHECK ("status" IN ('ACTIVE','RELEASED','CONSUMED')),
  CONSTRAINT "InventoryReservation_reference_unique" UNIQUE ("organizationId","referenceKey")
);
CREATE INDEX "InventoryReservation_active_idx" ON "InventoryReservation"("organizationId","materialLotId","siteId","departmentId") WHERE "status"='ACTIVE';

CREATE TABLE "InventoryLowStockThreshold" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "materialId" uuid NOT NULL,
  "siteId" uuid,
  "departmentId" uuid,
  "thresholdQuantity" numeric(18,4) NOT NULL,
  "unitOfMeasure" text NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryLowStockThreshold_material_fkey" FOREIGN KEY ("organizationId","materialId") REFERENCES "Material"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "InventoryLowStockThreshold_site_fkey" FOREIGN KEY ("organizationId","siteId") REFERENCES "Site"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "InventoryLowStockThreshold_department_fkey" FOREIGN KEY ("organizationId","departmentId") REFERENCES "Department"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "InventoryLowStockThreshold_actor_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "InventoryLowStockThreshold_qty_check" CHECK ("thresholdQuantity">=0),
  CONSTRAINT "InventoryLowStockThreshold_uom_check" CHECK (length(btrim("unitOfMeasure"))>0),
  CONSTRAINT "InventoryLowStockThreshold_scope_unique" UNIQUE NULLS NOT DISTINCT ("organizationId","materialId","siteId","departmentId")
);

CREATE TABLE "InventoryLowStockEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "thresholdId" uuid NOT NULL,
  "quantityOnHand" numeric(18,4) NOT NULL,
  "thresholdQuantity" numeric(18,4) NOT NULL,
  "unitOfMeasure" text NOT NULL,
  "openedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" timestamptz(3),
  CONSTRAINT "InventoryLowStockEvent_threshold_fkey" FOREIGN KEY ("thresholdId") REFERENCES "InventoryLowStockThreshold"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "InventoryLowStockEvent_open_unique" ON "InventoryLowStockEvent"("organizationId","thresholdId") WHERE "resolvedAt" IS NULL;
