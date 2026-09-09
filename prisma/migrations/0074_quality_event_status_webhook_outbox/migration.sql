CREATE OR REPLACE FUNCTION enqueue_quality_event_status_webhook_outbox()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.kind = 'STATUS' THEN
    INSERT INTO "IntegrationWebhookOutbox" (
      "organizationId",
      "eventId",
      "eventName",
      "data",
      "occurredAt"
    ) VALUES (
      NEW."organizationId",
      'quality_event.status:' || NEW.id::text,
      'quality_event.status',
      jsonb_build_object(
        'qualityEventId', NEW."eventId",
        'statusChangeId', NEW.id,
        'fromStatus', NEW."fromValue",
        'toStatus', NEW."toValue",
        'changedAt', NEW."createdAt"
      ),
      NEW."createdAt"
    )
    ON CONFLICT ("organizationId","eventId") DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "QualityEventChange_quality_event_status_webhook_outbox"
AFTER INSERT ON "QualityEventChange"
FOR EACH ROW
EXECUTE FUNCTION enqueue_quality_event_status_webhook_outbox();
