CREATE TYPE "IntegrationWebhookSubscriptionStatus" AS ENUM ('REGISTERED','REVOKED');

CREATE TABLE "IntegrationWebhookSubscription" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "integrationClientId" uuid NOT NULL,
  "endpointUrl" text NOT NULL,
  "events" text[] NOT NULL,
  "status" "IntegrationWebhookSubscriptionStatus" NOT NULL DEFAULT 'REGISTERED',
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedByUserId" uuid,
  "revokedAt" timestamptz,
  CONSTRAINT "IntegrationWebhookSubscription_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "IntegrationWebhookSubscription_client_fkey" FOREIGN KEY ("integrationClientId") REFERENCES "IntegrationClient"("id") ON DELETE RESTRICT,
  CONSTRAINT "IntegrationWebhookSubscription_created_by_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT,
  CONSTRAINT "IntegrationWebhookSubscription_revoked_by_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT,
  CONSTRAINT "IntegrationWebhookSubscription_events_nonempty" CHECK (cardinality("events") > 0),
  CONSTRAINT "IntegrationWebhookSubscription_revoke_consistency" CHECK ((status='REGISTERED' AND "revokedAt" IS NULL AND "revokedByUserId" IS NULL) OR (status='REVOKED' AND "revokedAt" IS NOT NULL AND "revokedByUserId" IS NOT NULL))
);

CREATE INDEX "IntegrationWebhookSubscription_org_status_idx" ON "IntegrationWebhookSubscription" ("organizationId",status,"createdAt" DESC);
CREATE INDEX "IntegrationWebhookSubscription_client_idx" ON "IntegrationWebhookSubscription" ("integrationClientId","createdAt" DESC);
