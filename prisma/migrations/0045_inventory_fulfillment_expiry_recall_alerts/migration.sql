ALTER TABLE "InventoryReservation" ADD COLUMN "consumedAt" timestamptz(3);
ALTER TABLE "InventoryReservation" ADD COLUMN "consumptionTransactionId" uuid;
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_consumption_tx_fkey" FOREIGN KEY ("consumptionTransactionId") REFERENCES "InventoryTransaction"("id") ON DELETE RESTRICT;

ALTER TABLE "MaterialLotStatusChange" ALTER COLUMN "actorUserId" DROP NOT NULL;

CREATE TABLE "InventoryAutomationEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "eventType" text NOT NULL,
  "materialLotId" uuid,
  "lowStockEventId" uuid,
  "level" integer NOT NULL DEFAULT 0,
  "eventKey" text NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryAutomationEvent_lot_fkey" FOREIGN KEY ("organizationId","materialLotId") REFERENCES "MaterialLot"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "InventoryAutomationEvent_low_stock_fkey" FOREIGN KEY ("lowStockEventId") REFERENCES "InventoryLowStockEvent"("id") ON DELETE RESTRICT,
  CONSTRAINT "InventoryAutomationEvent_level_check" CHECK ("level">=0),
  CONSTRAINT "InventoryAutomationEvent_key_unique" UNIQUE ("organizationId","eventKey")
);
CREATE INDEX "InventoryAutomationEvent_org_created_idx" ON "InventoryAutomationEvent"("organizationId","createdAt" DESC);

CREATE OR REPLACE FUNCTION reject_inventory_automation_event_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'InventoryAutomationEvent is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "InventoryAutomationEvent_append_only" BEFORE UPDATE OR DELETE ON "InventoryAutomationEvent" FOR EACH ROW EXECUTE FUNCTION reject_inventory_automation_event_mutation();