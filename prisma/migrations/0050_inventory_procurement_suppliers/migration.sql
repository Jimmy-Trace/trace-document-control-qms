CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE','INACTIVE');
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT','SUBMITTED','APPROVED','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED');
CREATE TYPE "PurchaseOrderAction" AS ENUM ('SUBMIT','APPROVE','ORDER','RECEIVE','CANCEL');

CREATE TABLE "Supplier" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "supplierNumber" text NOT NULL,
  "name" text NOT NULL,
  "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
  "contactName" text,
  "contactEmail" text,
  "contactPhone" text,
  "notes" text,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Supplier_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "Supplier_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "Supplier_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "Supplier_org_number_key" UNIQUE ("organizationId","supplierNumber"),
  CONSTRAINT "Supplier_number_check" CHECK (length(btrim("supplierNumber"))>0),
  CONSTRAINT "Supplier_name_check" CHECK (length(btrim("name"))>0)
);

CREATE TABLE "PurchaseOrder" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "purchaseOrderNumber" text NOT NULL,
  "supplierId" uuid NOT NULL,
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "orderedAt" timestamptz(3),
  "expectedAt" date,
  "notes" text,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseOrder_supplier_fkey" FOREIGN KEY ("organizationId","supplierId") REFERENCES "Supplier"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "PurchaseOrder_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "PurchaseOrder_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "PurchaseOrder_org_number_key" UNIQUE ("organizationId","purchaseOrderNumber"),
  CONSTRAINT "PurchaseOrder_number_check" CHECK (length(btrim("purchaseOrderNumber"))>0)
);

CREATE TABLE "PurchaseOrderLine" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "purchaseOrderId" uuid NOT NULL,
  "materialId" uuid NOT NULL,
  "quantityOrdered" numeric(18,4) NOT NULL,
  "unitOfMeasure" text NOT NULL,
  "unitPrice" numeric(18,4),
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseOrderLine_order_fkey" FOREIGN KEY ("organizationId","purchaseOrderId") REFERENCES "PurchaseOrder"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "PurchaseOrderLine_material_fkey" FOREIGN KEY ("organizationId","materialId") REFERENCES "Material"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "PurchaseOrderLine_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "PurchaseOrderLine_qty_check" CHECK ("quantityOrdered">0),
  CONSTRAINT "PurchaseOrderLine_uom_check" CHECK (length(btrim("unitOfMeasure"))>0),
  CONSTRAINT "PurchaseOrderLine_price_check" CHECK ("unitPrice" IS NULL OR "unitPrice">=0)
);

CREATE TABLE "PurchaseOrderReceipt" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "purchaseOrderLineId" uuid NOT NULL,
  "materialLotId" uuid NOT NULL,
  "quantityReceived" numeric(18,4) NOT NULL,
  "unitOfMeasure" text NOT NULL,
  "receivedByUserId" uuid NOT NULL,
  "receivedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseOrderReceipt_line_fkey" FOREIGN KEY ("organizationId","purchaseOrderLineId") REFERENCES "PurchaseOrderLine"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "PurchaseOrderReceipt_lot_fkey" FOREIGN KEY ("organizationId","materialLotId") REFERENCES "MaterialLot"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "PurchaseOrderReceipt_actor_fkey" FOREIGN KEY ("organizationId","receivedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "PurchaseOrderReceipt_qty_check" CHECK ("quantityReceived">0),
  CONSTRAINT "PurchaseOrderReceipt_uom_check" CHECK (length(btrim("unitOfMeasure"))>0)
);

CREATE TABLE "PurchaseOrderActionEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "purchaseOrderId" uuid NOT NULL,
  "action" "PurchaseOrderAction" NOT NULL,
  "fromStatus" "PurchaseOrderStatus" NOT NULL,
  "toStatus" "PurchaseOrderStatus" NOT NULL,
  "reason" text NOT NULL,
  "actorUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseOrderActionEvent_order_fkey" FOREIGN KEY ("organizationId","purchaseOrderId") REFERENCES "PurchaseOrder"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "PurchaseOrderActionEvent_actor_fkey" FOREIGN KEY ("organizationId","actorUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "PurchaseOrderActionEvent_reason_check" CHECK (length(btrim("reason"))>0)
);

CREATE INDEX "Supplier_org_status_idx" ON "Supplier"("organizationId","status");
CREATE INDEX "PurchaseOrder_org_status_idx" ON "PurchaseOrder"("organizationId","status");
CREATE INDEX "PurchaseOrderLine_org_order_idx" ON "PurchaseOrderLine"("organizationId","purchaseOrderId");
CREATE INDEX "PurchaseOrderReceipt_org_line_idx" ON "PurchaseOrderReceipt"("organizationId","purchaseOrderLineId","receivedAt" DESC);
CREATE INDEX "PurchaseOrderActionEvent_org_order_idx" ON "PurchaseOrderActionEvent"("organizationId","purchaseOrderId","createdAt" DESC);

CREATE OR REPLACE FUNCTION reject_procurement_evidence_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Procurement evidence is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "PurchaseOrderReceipt_append_only" BEFORE UPDATE OR DELETE ON "PurchaseOrderReceipt" FOR EACH ROW EXECUTE FUNCTION reject_procurement_evidence_mutation();
CREATE TRIGGER "PurchaseOrderActionEvent_append_only" BEFORE UPDATE OR DELETE ON "PurchaseOrderActionEvent" FOR EACH ROW EXECUTE FUNCTION reject_procurement_evidence_mutation();

INSERT INTO "Permission" ("id","key","description") VALUES
  (gen_random_uuid(),'procurement.read','View suppliers and purchase orders'),
  (gen_random_uuid(),'procurement.manage','Create and manage suppliers and purchase orders')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."systemRole"=true AND r."name"='System Administrator' AND p."key" IN ('procurement.read','procurement.manage')
ON CONFLICT ("roleId","permissionId") DO NOTHING;