CREATE OR REPLACE FUNCTION enqueue_equipment_status_webhook_outbox()
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
    'equipment.status:' || NEW.id::text,
    'equipment.status',
    jsonb_build_object(
      'equipmentId', NEW."equipmentId",
      'statusChangeId', NEW.id,
      'fromStatus', NEW."fromStatus",
      'toStatus', NEW."toStatus",
      'changedAt', NEW."changedAt"
    ),
    NEW."changedAt"
  )
  ON CONFLICT ("organizationId","eventId") DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "EquipmentStatusChange_equipment_status_webhook_outbox"
AFTER INSERT ON "EquipmentStatusChange"
FOR EACH ROW
EXECUTE FUNCTION enqueue_equipment_status_webhook_outbox();
