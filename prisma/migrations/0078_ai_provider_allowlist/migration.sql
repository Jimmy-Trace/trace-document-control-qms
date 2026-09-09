CREATE TYPE "AiProviderStatus" AS ENUM ('ACTIVE','INACTIVE');

CREATE TABLE "AiProviderProfile" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "code" text NOT NULL,
  "provider" text NOT NULL,
  "status" "AiProviderStatus" NOT NULL DEFAULT 'ACTIVE',
  "approvedModels" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "allowSourceContentEgress" boolean NOT NULL DEFAULT false,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedByUserId" uuid NOT NULL,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiProviderProfile_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "AiProviderProfile_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AiProviderProfile_updater_fkey" FOREIGN KEY ("organizationId","updatedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AiProviderProfile_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "AiProviderProfile_org_code_key" UNIQUE ("organizationId","code"),
  CONSTRAINT "AiProviderProfile_code_check" CHECK (length(btrim("code"))>0),
  CONSTRAINT "AiProviderProfile_provider_check" CHECK (length(btrim("provider"))>0),
  CONSTRAINT "AiProviderProfile_models_check" CHECK (cardinality("approvedModels")>0)
);

CREATE TABLE "AiProviderProfileEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "providerProfileId" uuid NOT NULL,
  "code" text NOT NULL,
  "provider" text NOT NULL,
  "status" "AiProviderStatus" NOT NULL,
  "approvedModels" text[] NOT NULL,
  "allowSourceContentEgress" boolean NOT NULL,
  "reason" text NOT NULL,
  "actorUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiProviderProfileEvent_profile_fkey" FOREIGN KEY ("organizationId","providerProfileId") REFERENCES "AiProviderProfile"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AiProviderProfileEvent_actor_fkey" FOREIGN KEY ("organizationId","actorUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AiProviderProfileEvent_reason_check" CHECK (length(btrim("reason"))>0)
);

CREATE INDEX "AiProviderProfile_org_status_idx" ON "AiProviderProfile"("organizationId",status,code);
CREATE INDEX "AiProviderProfileEvent_org_profile_idx" ON "AiProviderProfileEvent"("organizationId","providerProfileId","createdAt" DESC);

CREATE OR REPLACE FUNCTION reject_ai_provider_profile_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AI provider profile evidence is append-only';
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "AiProviderProfileEvent_append_only" BEFORE UPDATE OR DELETE ON "AiProviderProfileEvent" FOR EACH ROW EXECUTE FUNCTION reject_ai_provider_profile_event_mutation();
