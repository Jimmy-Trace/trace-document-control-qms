CREATE OR REPLACE FUNCTION enqueue_validation_project_status_webhook_outbox()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO "IntegrationWebhookOutbox" (
    "organizationId",
    "eventId",
    "eventName",
    "data",
    "occurredAt"
  ) VALUES (
    NEW."organizationId",
    'validation_project.status:' || NEW.id::text,
    'validation_project.status',
    jsonb_build_object(
      'validationProjectId', NEW."validationProjectId",
      'statusChangeId', NEW.id,
      'fromStatus', NEW."fromStatus",
      'toStatus', NEW."toStatus",
      'changedAt', NEW."createdAt"
    ),
    NEW."createdAt"
  )
  ON CONFLICT ("organizationId","eventId") DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ValidationProjectActionEvent_validation_project_status_webhook_outbox"
AFTER INSERT ON "ValidationProjectActionEvent"
FOR EACH ROW
EXECUTE FUNCTION enqueue_validation_project_status_webhook_outbox();
