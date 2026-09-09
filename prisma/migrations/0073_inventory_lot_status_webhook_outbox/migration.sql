CREATE OR REPLACE FUNCTION enqueue_inventory_lot_status_webhook_outbox()
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
    'inventory.lot.status:' || NEW.id::text,
    'inventory.lot.status',
    jsonb_build_object(
      'materialLotId', NEW."materialLotId",
      'materialLotStatusChangeId', NEW.id,
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

CREATE TRIGGER "MaterialLotStatusChange_inventory_lot_status_webhook_outbox"
AFTER INSERT ON "MaterialLotStatusChange"
FOR EACH ROW
EXECUTE FUNCTION enqueue_inventory_lot_status_webhook_outbox();
