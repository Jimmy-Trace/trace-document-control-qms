CREATE TABLE "AiTenantPolicy" (
  "organizationId" uuid PRIMARY KEY,
  "enabled" boolean NOT NULL DEFAULT false,
  "enabledUseCases" "AiAssistanceUseCase"[] NOT NULL DEFAULT ARRAY[]::"AiAssistanceUseCase"[],
  "allowExternalProvider" boolean NOT NULL DEFAULT false,
  "allowSourceContentEgress" boolean NOT NULL DEFAULT false,
  "updatedByUserId" uuid NOT NULL,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiTenantPolicy_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "AiTenantPolicy_updater_fkey" FOREIGN KEY ("organizationId","updatedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AiTenantPolicy_egress_requires_provider_check" CHECK (NOT "allowSourceContentEgress" OR "allowExternalProvider")
);

CREATE TABLE "AiTenantPolicyEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "enabled" boolean NOT NULL,
  "enabledUseCases" "AiAssistanceUseCase"[] NOT NULL,
  "allowExternalProvider" boolean NOT NULL,
  "allowSourceContentEgress" boolean NOT NULL,
  "reason" text NOT NULL,
  "actorUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiTenantPolicyEvent_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "AiTenantPolicyEvent_actor_fkey" FOREIGN KEY ("organizationId","actorUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AiTenantPolicyEvent_reason_check" CHECK (length(btrim("reason"))>0),
  CONSTRAINT "AiTenantPolicyEvent_egress_requires_provider_check" CHECK (NOT "allowSourceContentEgress" OR "allowExternalProvider")
);

CREATE INDEX "AiTenantPolicyEvent_org_created_idx" ON "AiTenantPolicyEvent"("organizationId","createdAt" DESC);

CREATE OR REPLACE FUNCTION reject_ai_tenant_policy_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AI tenant policy evidence is append-only';
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "AiTenantPolicyEvent_append_only" BEFORE UPDATE OR DELETE ON "AiTenantPolicyEvent" FOR EACH ROW EXECUTE FUNCTION reject_ai_tenant_policy_event_mutation();
