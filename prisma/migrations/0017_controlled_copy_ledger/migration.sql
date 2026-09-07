CREATE TYPE "ControlledCopyStatus" AS ENUM ('ISSUED','RECALL_REQUESTED','RETURNED','DESTROYED');

CREATE TABLE "ControlledCopy" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "documentVersionId" UUID NOT NULL,
  "copyNumber" INTEGER NOT NULL,
  "recipientName" TEXT NOT NULL,
  "location" TEXT,
  "purpose" TEXT NOT NULL,
  "status" "ControlledCopyStatus" NOT NULL DEFAULT 'ISSUED',
  "issuedByUserId" UUID NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recallRequestedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "closureReason" TEXT,
  CONSTRAINT "ControlledCopy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ControlledCopy_copyNumber_positive" CHECK ("copyNumber" > 0)
);

CREATE UNIQUE INDEX "ControlledCopy_organizationId_documentVersionId_copyNumber_key"
  ON "ControlledCopy"("organizationId","documentVersionId","copyNumber");
CREATE INDEX "ControlledCopy_organizationId_status_idx"
  ON "ControlledCopy"("organizationId","status");
CREATE INDEX "ControlledCopy_organizationId_documentVersionId_idx"
  ON "ControlledCopy"("organizationId","documentVersionId");

ALTER TABLE "ControlledCopy" ADD CONSTRAINT "ControlledCopy_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ControlledCopy" ADD CONSTRAINT "ControlledCopy_documentVersion_fkey"
  FOREIGN KEY ("organizationId","documentVersionId") REFERENCES "DocumentVersion"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ControlledCopy" ADD CONSTRAINT "ControlledCopy_issuedByUser_fkey"
  FOREIGN KEY ("organizationId","issuedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
