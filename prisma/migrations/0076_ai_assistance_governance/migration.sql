CREATE TYPE "AiAssistanceUseCase" AS ENUM ('DOCUMENT_SEARCH','DRAFTING','SUMMARIZATION','CLASSIFICATION','QUALITY_ANALYTICS');
CREATE TYPE "AiAssistanceEventType" AS ENUM ('REQUESTED','COMPLETED','REJECTED','FAILED');

CREATE TABLE "AiAssistanceEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "correlationId" uuid NOT NULL,
  "eventType" "AiAssistanceEventType" NOT NULL,
  "useCase" "AiAssistanceUseCase" NOT NULL,
  "sourceEntityType" text,
  "sourceEntityId" uuid,
  "inputSha256" text,
  "outputSha256" text,
  "provider" text,
  "model" text,
  "actorUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiAssistanceEvent_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "AiAssistanceEvent_actor_fkey" FOREIGN KEY ("organizationId","actorUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AiAssistanceEvent_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "AiAssistanceEvent_source_pair_check" CHECK (("sourceEntityType" IS NULL) = ("sourceEntityId" IS NULL)),
  CONSTRAINT "AiAssistanceEvent_input_hash_check" CHECK ("inputSha256" IS NULL OR "inputSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "AiAssistanceEvent_output_hash_check" CHECK ("outputSha256" IS NULL OR "outputSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "AiAssistanceEvent_request_shape_check" CHECK ("eventType" <> 'REQUESTED' OR ("inputSha256" IS NOT NULL AND "outputSha256" IS NULL AND "provider" IS NULL AND "model" IS NULL)),
  CONSTRAINT "AiAssistanceEvent_completed_shape_check" CHECK ("eventType" <> 'COMPLETED' OR ("outputSha256" IS NOT NULL AND "provider" IS NOT NULL AND length(btrim("provider"))>0 AND "model" IS NOT NULL AND length(btrim("model"))>0))
);

CREATE INDEX "AiAssistanceEvent_org_created_idx" ON "AiAssistanceEvent"("organizationId","createdAt" DESC);
CREATE INDEX "AiAssistanceEvent_org_correlation_idx" ON "AiAssistanceEvent"("organizationId","correlationId","createdAt");
CREATE INDEX "AiAssistanceEvent_org_use_case_idx" ON "AiAssistanceEvent"("organizationId","useCase","createdAt" DESC);
CREATE UNIQUE INDEX "AiAssistanceEvent_request_uidx" ON "AiAssistanceEvent"("organizationId","correlationId") WHERE "eventType"='REQUESTED';
CREATE UNIQUE INDEX "AiAssistanceEvent_terminal_uidx" ON "AiAssistanceEvent"("organizationId","correlationId") WHERE "eventType"<>'REQUESTED';

CREATE OR REPLACE FUNCTION reject_ai_assistance_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AI assistance evidence is append-only';
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "AiAssistanceEvent_append_only" BEFORE UPDATE OR DELETE ON "AiAssistanceEvent" FOR EACH ROW EXECUTE FUNCTION reject_ai_assistance_event_mutation();

INSERT INTO "Permission" ("id","key","description") VALUES
  (gen_random_uuid(),'ai.assist','Use approved assistive AI capabilities without regulated decision authority'),
  (gen_random_uuid(),'ai.manage','Manage governed AI assistance policy and operational configuration')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."systemRole"=true AND r."name"='System Administrator' AND p."key" IN ('ai.assist','ai.manage')
ON CONFLICT ("roleId","permissionId") DO NOTHING;
