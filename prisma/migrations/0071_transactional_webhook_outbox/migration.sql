CREATE TABLE "IntegrationWebhookOutbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "eventId" text NOT NULL,
  "eventName" text NOT NULL,
  "data" jsonb NOT NULL,
  "occurredAt" timestamptz NOT NULL,
  "attemptCount" integer NOT NULL DEFAULT 0,
  "nextAttemptAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAttemptAt" timestamptz,
  "lastError" text,
  "publishedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationWebhookOutbox_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "IntegrationWebhookOutbox_attempt_count" CHECK ("attemptCount" >= 0)
);

CREATE UNIQUE INDEX "IntegrationWebhookOutbox_org_event_uidx" ON "IntegrationWebhookOutbox" ("organizationId","eventId");
CREATE INDEX "IntegrationWebhookOutbox_due_idx" ON "IntegrationWebhookOutbox" ("publishedAt","nextAttemptAt","createdAt");

CREATE OR REPLACE FUNCTION enqueue_document_effective_webhook_outbox()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'EFFECTIVE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO "IntegrationWebhookOutbox" (
      "organizationId",
      "eventId",
      "eventName",
      "data",
      "occurredAt"
    ) VALUES (
      NEW."organizationId",
      'document.effective:' || NEW.id::text,
      'document.effective',
      jsonb_build_object(
        'documentId', NEW."documentId",
        'documentVersionId', NEW.id,
        'status', 'EFFECTIVE',
        'effectiveAt', NEW."effectiveAt"
      ),
      COALESCE(NEW."effectiveAt", CURRENT_TIMESTAMP)
    )
    ON CONFLICT ("organizationId","eventId") DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "DocumentVersion_document_effective_webhook_outbox"
AFTER UPDATE OF status ON "DocumentVersion"
FOR EACH ROW
EXECUTE FUNCTION enqueue_document_effective_webhook_outbox();
