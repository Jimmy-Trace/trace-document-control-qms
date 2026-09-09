CREATE TABLE "SavedReportView" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "reportDefinitionId" uuid NOT NULL,
  "ownerUserId" uuid NOT NULL,
  "name" text NOT NULL,
  "parameters" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedReportView_definition_fkey" FOREIGN KEY ("organizationId","reportDefinitionId") REFERENCES "ReportDefinition"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "SavedReportView_owner_fkey" FOREIGN KEY ("organizationId","ownerUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "SavedReportView_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "SavedReportView_owner_name_key" UNIQUE ("organizationId","ownerUserId","reportDefinitionId","name"),
  CONSTRAINT "SavedReportView_name_check" CHECK (length(btrim("name"))>0),
  CONSTRAINT "SavedReportView_parameters_object_check" CHECK (jsonb_typeof("parameters")='object')
);

CREATE INDEX "SavedReportView_owner_idx" ON "SavedReportView"("organizationId","ownerUserId","reportDefinitionId","updatedAt" DESC);
