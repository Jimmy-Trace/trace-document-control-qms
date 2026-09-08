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

CREATE OR REPLACE FUNCTION guard_purchase_order_status_transition() RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status='DRAFT' AND NEW.status IN ('SUBMITTED','CANCELLED')) OR
    (OLD.status='SUBMITTED' AND NEW.status IN ('APPROVED','CANCELLED')) OR
    (OLD.status='APPROVED' AND NEW.status IN ('ORDERED','CANCELLED')) OR
    (OLD.status='ORDERED' AND NEW.status IN ('PARTIALLY_RECEIVED','RECEIVED','CANCELLED')) OR
    (OLD.status='PARTIALLY_RECEIVED' AND NEW.status='RECEIVED')
  ) THEN RAISE EXCEPTION 'Invalid purchase order status transition from % to %',OLD.status,NEW.status; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "PurchaseOrder_status_guard" BEFORE UPDATE OF status ON "PurchaseOrder" FOR EACH ROW EXECUTE FUNCTION guard_purchase_order_status_transition();

CREATE OR REPLACE FUNCTION guard_purchase_order_receipt() RETURNS trigger AS $$
DECLARE ordered numeric(18,4); prior numeric(18,4); line_uom text; line_material uuid; order_status "PurchaseOrderStatus"; lot_material uuid;
BEGIN
  SELECT l."quantityOrdered",l."unitOfMeasure",l."materialId",o.status INTO ordered,line_uom,line_material,order_status
  FROM "PurchaseOrderLine" l JOIN "PurchaseOrder" o ON o."organizationId"=l."organizationId" AND o.id=l."purchaseOrderId"
  WHERE l."organizationId"=NEW."organizationId" AND l.id=NEW."purchaseOrderLineId" FOR UPDATE OF l;
  IF ordered IS NULL OR order_status NOT IN ('ORDERED','PARTIALLY_RECEIVED') THEN RAISE EXCEPTION 'Purchase order line is not receivable'; END IF;
  SELECT "materialId" INTO lot_material FROM "MaterialLot" WHERE "organizationId"=NEW."organizationId" AND id=NEW."materialLotId";
  IF lot_material IS NULL OR lot_material<>line_material THEN RAISE EXCEPTION 'Received lot must belong to ordered material'; END IF;
  IF NEW."unitOfMeasure"<>line_uom THEN RAISE EXCEPTION 'Receipt unit must match purchase order line unit'; END IF;
  SELECT COALESCE(sum("quantityReceived"),0) INTO prior FROM "PurchaseOrderReceipt" WHERE "organizationId"=NEW."organizationId" AND "purchaseOrderLineId"=NEW."purchaseOrderLineId";
  IF prior+NEW."quantityReceived">ordered THEN RAISE EXCEPTION 'Receipt exceeds ordered quantity'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "PurchaseOrderReceipt_guard" BEFORE INSERT ON "PurchaseOrderReceipt" FOR EACH ROW EXECUTE FUNCTION guard_purchase_order_receipt();

INSERT INTO "Permission" ("id","key","description") VALUES
  (gen_random_uuid(),'procurement.read','View suppliers and purchase orders'),
  (gen_random_uuid(),'procurement.manage','Create and manage suppliers and purchase orders')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."systemRole"=true AND r."name"='System Administrator' AND p."key" IN ('procurement.read','procurement.manage')
ON CONFLICT ("roleId","permissionId") DO NOTHING;
