ALTER TABLE "TrainingAssignment"
  ADD COLUMN "cancelledAt" timestamptz(3),
  ADD COLUMN "cancelReason" text,
  ADD COLUMN "cancelledByUserId" uuid;

ALTER TABLE "TrainingAssignment"
  ADD CONSTRAINT "TrainingAssignment_cancelledBy_fkey"
  FOREIGN KEY ("organizationId", "cancelledByUserId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TrainingAssignment_cancel_fields_check" CHECK (
    ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL AND "cancelReason" IS NOT NULL AND length(btrim("cancelReason")) > 0 AND "cancelledByUserId" IS NOT NULL)
    OR
    ("status" <> 'CANCELLED' AND "cancelledAt" IS NULL AND "cancelReason" IS NULL AND "cancelledByUserId" IS NULL)
  );
