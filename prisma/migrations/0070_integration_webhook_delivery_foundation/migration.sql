ALTER TABLE "IntegrationWebhookSubscription"
  ADD COLUMN "signingKeyVersion" integer NOT NULL DEFAULT 1;

CREATE TYPE "IntegrationWebhookDeliveryStatus" AS ENUM ('PENDING','PROCESSING','RETRY','SUCCEEDED','DEAD_LETTER');

CREATE TABLE "IntegrationWebhookDelivery" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "integrationClientId" uuid NOT NULL,
  "subscriptionId" uuid NOT NULL,
  "eventId" text NOT NULL,
  "eventName" text NOT NULL,
  "payload" jsonb NOT NULL,
  "payloadHash" text NOT NULL,
  "status" "IntegrationWebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" integer NOT NULL DEFAULT 0,
  "nextAttemptAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAttemptAt" timestamptz,
  "responseStatus" integer,
  "lastError" text,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" timestamptz,
  CONSTRAINT "IntegrationWebhookDelivery_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "IntegrationWebhookDelivery_client_fkey" FOREIGN KEY ("integrationClientId") REFERENCES "IntegrationClient"("id") ON DELETE RESTRICT,
  CONSTRAINT "IntegrationWebhookDelivery_subscription_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "IntegrationWebhookSubscription"("id") ON DELETE RESTRICT,
  CONSTRAINT "IntegrationWebhookDelivery_attempt_count" CHECK ("attemptCount" >= 0 AND "attemptCount" <= 5),
  CONSTRAINT "IntegrationWebhookDelivery_terminal_consistency" CHECK ((status='SUCCEEDED' AND "deliveredAt" IS NOT NULL) OR (status<>'SUCCEEDED' AND "deliveredAt" IS NULL))
);

CREATE UNIQUE INDEX "IntegrationWebhookDelivery_subscription_event_uidx" ON "IntegrationWebhookDelivery" ("subscriptionId","eventId");
CREATE INDEX "IntegrationWebhookDelivery_due_idx" ON "IntegrationWebhookDelivery" (status,"nextAttemptAt","createdAt");
CREATE INDEX "IntegrationWebhookDelivery_org_idx" ON "IntegrationWebhookDelivery" ("organizationId","createdAt" DESC);
