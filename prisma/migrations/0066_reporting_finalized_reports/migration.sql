CREATE TABLE "FinalizedReport" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "reportExecutionId" uuid NOT NULL,
  "reportCode" text NOT NULL,
  "reportName" text NOT NULL,
  "sourceKey" "ReportSourceKey" NOT NULL,
  "parameters" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "result" jsonb NOT NULL,
  "resultSha256" text NOT NULL,
  "rowCount" integer NOT NULL,
  "finalizedByUserId" uuid NOT NULL,
  "finalizedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinalizedReport_execution_fkey" FOREIGN KEY ("organizationId","reportExecutionId") REFERENCES "ReportExecution"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "FinalizedReport_actor_fkey" FOREIGN KEY ("organizationId","finalizedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "FinalizedReport_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "FinalizedReport_org_execution_key" UNIQUE ("organizationId","reportExecutionId"),
  CONSTRAINT "FinalizedReport_hash_check" CHECK ("resultSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "FinalizedReport_row_count_check" CHECK ("rowCount" >= 0)
);

CREATE INDEX "FinalizedReport_org_time_idx" ON "FinalizedReport"("organizationId","finalizedAt" DESC);

CREATE OR REPLACE FUNCTION reject_finalized_report_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Finalized report records are append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "FinalizedReport_append_only" BEFORE UPDATE OR DELETE ON "FinalizedReport" FOR EACH ROW EXECUTE FUNCTION reject_finalized_report_mutation();

INSERT INTO "Permission" ("id","key","description") VALUES
  (gen_random_uuid(),'report.export','Export finalized governed reports')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."systemRole"=true AND r."name"='System Administrator' AND p."key"='report.export'
ON CONFLICT ("roleId","permissionId") DO NOTHING;
