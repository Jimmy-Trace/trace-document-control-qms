CREATE TYPE "QualityRecordStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "RecordType" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecordType_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecordType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RecordType_organizationId_id_key" UNIQUE ("organizationId", "id"),
  CONSTRAINT "RecordType_organizationId_code_key" UNIQUE ("organizationId", "code")
);

CREATE TABLE "QualityRecord" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "recordTypeId" uuid NOT NULL,
  "recordNumber" text NOT NULL,
  "title" text NOT NULL,
  "status" "QualityRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "occurredAt" timestamptz(3),
  "fileId" uuid,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QualityRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QualityRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityRecord_recordType_fkey" FOREIGN KEY ("organizationId", "recordTypeId") REFERENCES "RecordType"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityRecord_file_fkey" FOREIGN KEY ("organizationId", "fileId") REFERENCES "FileObject"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityRecord_creator_fkey" FOREIGN KEY ("organizationId", "createdByUserId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityRecord_organizationId_id_key" UNIQUE ("organizationId", "id"),
  CONSTRAINT "QualityRecord_organizationId_recordNumber_key" UNIQUE ("organizationId", "recordNumber")
);

CREATE INDEX "QualityRecord_organizationId_recordTypeId_createdAt_idx" ON "QualityRecord"("organizationId", "recordTypeId", "createdAt");
CREATE INDEX "QualityRecord_organizationId_status_createdAt_idx" ON "QualityRecord"("organizationId", "status", "createdAt");

INSERT INTO "Permission" ("id", "key", "description")
VALUES
  (gen_random_uuid(), 'record.read', 'View regulated quality records'),
  (gen_random_uuid(), 'record.create', 'Create regulated quality records')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."systemRole" = true
  AND r."name" = 'System Administrator'
  AND p."key" IN ('record.read', 'record.create')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
