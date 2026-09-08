CREATE TABLE "InventoryLabelIssue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "materialLotId" uuid NOT NULL,
  "barcodeValue" text NOT NULL,
  "labelPayload" jsonb NOT NULL,
  "issuedByUserId" uuid NOT NULL,
  "issuedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryLabelIssue_lot_fkey" FOREIGN KEY ("organizationId","materialLotId") REFERENCES "MaterialLot"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "InventoryLabelIssue_actor_fkey" FOREIGN KEY ("organizationId","issuedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "InventoryLabelIssue_barcode_check" CHECK (length(btrim("barcodeValue"))>0)
);
CREATE INDEX "InventoryLabelIssue_org_lot_idx" ON "InventoryLabelIssue"("organizationId","materialLotId","issuedAt" DESC);

CREATE OR REPLACE FUNCTION reject_inventory_label_issue_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'InventoryLabelIssue is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "InventoryLabelIssue_append_only" BEFORE UPDATE OR DELETE ON "InventoryLabelIssue" FOR EACH ROW EXECUTE FUNCTION reject_inventory_label_issue_mutation();
