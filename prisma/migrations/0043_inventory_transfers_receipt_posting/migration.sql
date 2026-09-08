ALTER TYPE "InventoryTransactionType" ADD VALUE IF NOT EXISTS 'RECEIPT';
ALTER TYPE "InventoryTransactionType" ADD VALUE IF NOT EXISTS 'TRANSFER_IN';
ALTER TYPE "InventoryTransactionType" ADD VALUE IF NOT EXISTS 'TRANSFER_OUT';

ALTER TABLE "InventoryTransaction" ADD COLUMN "transferKey" text;
ALTER TABLE "MaterialLot" ADD COLUMN "receiptPostedAt" timestamptz(3);

CREATE UNIQUE INDEX "InventoryTransaction_transfer_direction_unique"
  ON "InventoryTransaction"("organizationId","transferKey","transactionType")
  WHERE "transferKey" IS NOT NULL AND "transactionType" IN ('TRANSFER_IN','TRANSFER_OUT');

CREATE UNIQUE INDEX "InventoryTransaction_lot_receipt_unique"
  ON "InventoryTransaction"("organizationId","materialLotId","transactionType")
  WHERE "transactionType"='RECEIPT';

CREATE INDEX "InventoryTransaction_transfer_idx"
  ON "InventoryTransaction"("organizationId","transferKey")
  WHERE "transferKey" IS NOT NULL;
