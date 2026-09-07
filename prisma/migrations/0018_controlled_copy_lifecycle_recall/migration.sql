CREATE OR REPLACE FUNCTION recall_controlled_copies_on_version_obsolescence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  recalled RECORD;
BEGIN
  IF OLD."status" = 'EFFECTIVE'
     AND NEW."status" IN ('SUPERSEDED', 'RETIRED')
     AND NEW."status" IS DISTINCT FROM OLD."status" THEN
    FOR recalled IN
      UPDATE "ControlledCopy"
      SET "status" = 'RECALL_REQUESTED',
          "recallRequestedAt" = COALESCE("recallRequestedAt", CURRENT_TIMESTAMP)
      WHERE "organizationId" = NEW."organizationId"
        AND "documentVersionId" = NEW."id"
        AND "status" = 'ISSUED'
      RETURNING "id", "copyNumber", "documentVersionId"
    LOOP
      INSERT INTO "AuditEvent" (
        "organizationId",
        "action",
        "entityType",
        "entityId",
        "entityVersion",
        "metadata"
      ) VALUES (
        NEW."organizationId",
        'CONTROLLED_COPY_RECALL_AUTOMATED',
        'ControlledCopy',
        recalled."id",
        recalled."copyNumber"::text,
        jsonb_build_object(
          'documentVersionId', recalled."documentVersionId",
          'copyNumber', recalled."copyNumber",
          'trigger', 'DOCUMENT_VERSION_' || NEW."status"::text,
          'fromStatus', 'ISSUED',
          'toStatus', 'RECALL_REQUESTED'
        )
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "DocumentVersion_controlled_copy_recall" ON "DocumentVersion";
CREATE TRIGGER "DocumentVersion_controlled_copy_recall"
AFTER UPDATE OF "status" ON "DocumentVersion"
FOR EACH ROW
EXECUTE FUNCTION recall_controlled_copies_on_version_obsolescence();
