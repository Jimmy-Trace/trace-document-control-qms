CREATE TYPE "ReportSourceKey" AS ENUM ('QUALITY_EVENT_SUMMARY','EQUIPMENT_SUMMARY');

CREATE TABLE "ReportDefinition" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "sourceKey" "ReportSourceKey" NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReportDefinition_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "ReportDefinition_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ReportDefinition_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "ReportDefinition_org_code_key" UNIQUE ("organizationId","code"),
  CONSTRAINT "ReportDefinition_code_check" CHECK (length(btrim("code"))>0),
  CONSTRAINT "ReportDefinition_name_check" CHECK (length(btrim("name"))>0)
);

CREATE TABLE "ReportExecution" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "reportDefinitionId" uuid NOT NULL,
  "reportCode" text NOT NULL,
  "reportName" text NOT NULL,
  "sourceKey" "ReportSourceKey" NOT NULL,
  "parameters" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "result" jsonb NOT NULL,
  "resultSha256" text NOT NULL,
  "rowCount" integer NOT NULL DEFAULT 0,
  "executedByUserId" uuid NOT NULL,
  "executedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReportExecution_definition_fkey" FOREIGN KEY ("organizationId","reportDefinitionId") REFERENCES "ReportDefinition"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ReportExecution_actor_fkey" FOREIGN KEY ("organizationId","executedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ReportExecution_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "ReportExecution_hash_check" CHECK ("resultSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "ReportExecution_row_count_check" CHECK ("rowCount">=0)
);

CREATE INDEX "ReportDefinition_org_active_idx" ON "ReportDefinition"("organizationId","active","code");
CREATE INDEX "ReportExecution_org_definition_idx" ON "ReportExecution"("organizationId","reportDefinitionId","executedAt" DESC);
CREATE INDEX "ReportExecution_org_actor_idx" ON "ReportExecution"("organizationId","executedByUserId","executedAt" DESC);

CREATE OR REPLACE FUNCTION reject_report_execution_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Report execution evidence is append-only';
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "ReportExecution_append_only" BEFORE UPDATE OR DELETE ON "ReportExecution" FOR EACH ROW EXECUTE FUNCTION reject_report_execution_mutation();

INSERT INTO "Permission" ("id","key","description") VALUES
  (gen_random_uuid(),'report.read','View and execute governed read-only reports'),
  (gen_random_uuid(),'report.manage','Create and manage governed report definitions')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."systemRole"=true AND r."name"='System Administrator' AND p."key" IN ('report.read','report.manage')
ON CONFLICT ("roleId","permissionId") DO NOTHING;
