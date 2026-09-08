CREATE TYPE "QualityEventChangeKind" AS ENUM ('STATUS','OWNER','DUE_DATE');

CREATE TABLE "QualityEventChange" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "eventId" uuid NOT NULL,
  "kind" "QualityEventChangeKind" NOT NULL,
  "fromValue" text,
  "toValue" text,
  "reason" text NOT NULL,
  "actorUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QualityEventChange_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QualityEventChange_event_fkey" FOREIGN KEY ("organizationId", "eventId") REFERENCES "QualityEvent"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityEventChange_actor_fkey" FOREIGN KEY ("organizationId", "actorUserId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityEventChange_reason_not_blank_check" CHECK (length(btrim("reason")) > 0)
);

CREATE INDEX "QualityEventChange_org_event_created_idx" ON "QualityEventChange"("organizationId", "eventId", "createdAt" DESC);
