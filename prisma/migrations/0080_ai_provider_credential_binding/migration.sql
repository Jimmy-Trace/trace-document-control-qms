CREATE TYPE "AiProviderCredentialStatus" AS ENUM ('ACTIVE','INACTIVE');

CREATE TABLE "AiProviderCredentialBinding" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "providerProfileId" uuid NOT NULL,
  "runtimeSecretName" text NOT NULL,
  "status" "AiProviderCredentialStatus" NOT NULL DEFAULT 'INACTIVE',
  "credentialVersion" integer NOT NULL DEFAULT 1,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedByUserId" uuid NOT NULL,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiProviderCredentialBinding_profile_fkey" FOREIGN KEY ("organizationId","providerProfileId") REFERENCES "AiProviderProfile"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AiProviderCredentialBinding_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AiProviderCredentialBinding_updater_fkey" FOREIGN KEY ("organizationId","updatedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AiProviderCredentialBinding_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "AiProviderCredentialBinding_profile_key" UNIQUE ("organizationId","providerProfileId"),
  CONSTRAINT "AiProviderCredentialBinding_secret_name_check" CHECK ("runtimeSecretName" ~ '^AI_PROVIDER_CREDENTIAL_[A-Z0-9_]{1,48}$'),
  CONSTRAINT "AiProviderCredentialBinding_version_check" CHECK ("credentialVersion" >= 1)
);

CREATE TABLE "AiProviderCredentialBindingEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "credentialBindingId" uuid NOT NULL,
  "providerProfileId" uuid NOT NULL,
  "runtimeSecretName" text NOT NULL,
  "status" "AiProviderCredentialStatus" NOT NULL,
  "credentialVersion" integer NOT NULL,
  "reason" text NOT NULL,
  "actorUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiProviderCredentialBindingEvent_binding_fkey" FOREIGN KEY ("organizationId","credentialBindingId") REFERENCES "AiProviderCredentialBinding"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AiProviderCredentialBindingEvent_profile_fkey" FOREIGN KEY ("organizationId","providerProfileId") REFERENCES "AiProviderProfile"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AiProviderCredentialBindingEvent_actor_fkey" FOREIGN KEY ("organizationId","actorUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AiProviderCredentialBindingEvent_reason_check" CHECK (length(btrim("reason")) > 0),
  CONSTRAINT "AiProviderCredentialBindingEvent_secret_name_check" CHECK ("runtimeSecretName" ~ '^AI_PROVIDER_CREDENTIAL_[A-Z0-9_]{1,48}$'),
  CONSTRAINT "AiProviderCredentialBindingEvent_version_check" CHECK ("credentialVersion" >= 1)
);

CREATE INDEX "AiProviderCredentialBinding_org_status_idx" ON "AiProviderCredentialBinding"("organizationId",status,"providerProfileId");
CREATE INDEX "AiProviderCredentialBindingEvent_org_binding_idx" ON "AiProviderCredentialBindingEvent"("organizationId","credentialBindingId","createdAt" DESC);

CREATE OR REPLACE FUNCTION reject_ai_provider_credential_binding_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AI provider credential binding evidence is append-only';
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "AiProviderCredentialBindingEvent_append_only" BEFORE UPDATE OR DELETE ON "AiProviderCredentialBindingEvent" FOR EACH ROW EXECUTE FUNCTION reject_ai_provider_credential_binding_event_mutation();
