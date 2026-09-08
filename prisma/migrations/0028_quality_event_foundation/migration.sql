CREATE TYPE "QualityEventType" AS ENUM ('NONCONFORMANCE','PATIENT_COMPLAINT','PHYSICIAN_COMPLAINT','SPECIMEN_PROBLEM','TESTING_ERROR','QC_FAILURE','PT_FAILURE','EQUIPMENT_FAILURE','REPORTING_ERROR','BILLING_ADMINISTRATIVE','SAFETY_EVENT','PERSONNEL_EVENT','DEVIATION','OTHER');
CREATE TYPE "QualityEventSeverity" AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
CREATE TYPE "QualityEventSource" AS ENUM ('MANUAL','SYSTEM');
CREATE TYPE "QualityEventStatus" AS ENUM ('OPEN','INVESTIGATING','ACTION_REQUIRED','VERIFICATION','CLOSED');

CREATE TABLE "QualityEventCounter" (
  "organizationId" uuid NOT NULL,
  "nextNumber" integer NOT NULL DEFAULT 1,
  CONSTRAINT "QualityEventCounter_pkey" PRIMARY KEY ("organizationId"),
  CONSTRAINT "QualityEventCounter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityEventCounter_nextNumber_check" CHECK ("nextNumber" > 0)
);

CREATE TABLE "QualityEvent" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "eventNumber" text NOT NULL,
  "type" "QualityEventType" NOT NULL,
  "severity" "QualityEventSeverity" NOT NULL,
  "source" "QualityEventSource" NOT NULL DEFAULT 'MANUAL',
  "status" "QualityEventStatus" NOT NULL DEFAULT 'OPEN',
  "summary" text NOT NULL,
  "description" text,
  "discoveredAt" timestamptz(3) NOT NULL,
  "reportedByUserId" uuid NOT NULL,
  "ownerUserId" uuid,
  "dueAt" date,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QualityEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QualityEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityEvent_reporter_fkey" FOREIGN KEY ("organizationId", "reportedByUserId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityEvent_owner_fkey" FOREIGN KEY ("organizationId", "ownerUserId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityEvent_organizationId_id_key" UNIQUE ("organizationId", "id"),
  CONSTRAINT "QualityEvent_organizationId_eventNumber_key" UNIQUE ("organizationId", "eventNumber"),
  CONSTRAINT "QualityEvent_summary_not_blank_check" CHECK (length(btrim("summary")) > 0)
);

CREATE INDEX "QualityEvent_org_status_due_idx" ON "QualityEvent"("organizationId", "status", "dueAt");
CREATE INDEX "QualityEvent_org_type_created_idx" ON "QualityEvent"("organizationId", "type", "createdAt" DESC);
CREATE INDEX "QualityEvent_org_owner_status_idx" ON "QualityEvent"("organizationId", "ownerUserId", "status") WHERE "ownerUserId" IS NOT NULL;

INSERT INTO "Permission" ("id", "key", "description")
VALUES
  (gen_random_uuid(), 'quality_event.read', 'View governed quality events'),
  (gen_random_uuid(), 'quality_event.manage', 'Create and manage governed quality events')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."systemRole" = true
  AND r."name" = 'System Administrator'
  AND p."key" IN ('quality_event.read', 'quality_event.manage')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
