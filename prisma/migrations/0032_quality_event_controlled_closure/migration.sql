CREATE TABLE "QualityEventClosure" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "eventId" uuid NOT NULL,
  "closedByUserId" uuid NOT NULL,
  "closureReason" text NOT NULL,
  "signatureId" uuid NOT NULL,
  "closedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QualityEventClosure_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QualityEventClosure_org_event_key" UNIQUE ("organizationId","eventId"),
  CONSTRAINT "QualityEventClosure_signature_key" UNIQUE ("signatureId"),
  CONSTRAINT "QualityEventClosure_event_fkey" FOREIGN KEY ("organizationId","eventId") REFERENCES "QualityEvent"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityEventClosure_user_fkey" FOREIGN KEY ("organizationId","closedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityEventClosure_signature_fkey" FOREIGN KEY ("signatureId") REFERENCES "ElectronicSignature"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityEventClosure_reason_not_blank_check" CHECK (length(btrim("closureReason")) > 0)
);
CREATE INDEX "QualityEventClosure_org_closedAt_idx" ON "QualityEventClosure"("organizationId","closedAt" DESC);
