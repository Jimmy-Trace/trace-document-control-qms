CREATE TABLE "MaterialRecallImpact" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "materialRecallId" uuid NOT NULL,
  "materialLotId" uuid NOT NULL,
  "priorUseCount" integer NOT NULL DEFAULT 0,
  "affectedEquipmentCount" integer NOT NULL DEFAULT 0,
  "earliestUseAt" timestamptz(3),
  "latestUseAt" timestamptz(3),
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaterialRecallImpact_recall_fkey" FOREIGN KEY ("organizationId","materialRecallId") REFERENCES "MaterialRecall"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "MaterialRecallImpact_lot_fkey" FOREIGN KEY ("organizationId","materialLotId") REFERENCES "MaterialLot"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "MaterialRecallImpact_unique" UNIQUE ("organizationId","materialRecallId","materialLotId"),
  CONSTRAINT "MaterialRecallImpact_counts_check" CHECK ("priorUseCount">=0 AND "affectedEquipmentCount">=0)
);

ALTER TABLE "MaterialRecall" ADD CONSTRAINT "MaterialRecall_org_id_key" UNIQUE ("organizationId","id");
ALTER TABLE "MaterialRecallLot" ADD CONSTRAINT "MaterialRecallLot_org_id_key" UNIQUE ("organizationId","id");

CREATE INDEX "MaterialRecallImpact_org_recall_idx" ON "MaterialRecallImpact"("organizationId","materialRecallId");
CREATE INDEX "MaterialRecallImpact_org_lot_idx" ON "MaterialRecallImpact"("organizationId","materialLotId");

CREATE OR REPLACE FUNCTION require_material_lot_acceptance_certificate() RETURNS trigger AS $$
BEGIN
  IF NEW.status='ACCEPTED'::"MaterialLotStatus" AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT EXISTS (
      SELECT 1 FROM "MaterialLotAcceptanceCertificate" c
      WHERE c."organizationId"=NEW."organizationId" AND c."materialLotId"=NEW.id
    ) THEN
      RAISE EXCEPTION 'Material lot acceptance requires governed acceptance certificate evidence';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "MaterialLot_acceptance_certificate_required"
BEFORE UPDATE OF status ON "MaterialLot"
FOR EACH ROW EXECUTE FUNCTION require_material_lot_acceptance_certificate();

CREATE OR REPLACE FUNCTION capture_material_recall_impact() RETURNS trigger AS $$
BEGIN
  INSERT INTO "MaterialRecallImpact" (
    "organizationId","materialRecallId","materialLotId","priorUseCount","affectedEquipmentCount","earliestUseAt","latestUseAt"
  )
  SELECT NEW."organizationId",NEW."materialRecallId",NEW."materialLotId",
         count(u.id)::integer,count(DISTINCT u."equipmentId")::integer,min(u."usedAt"),max(u."usedAt")
  FROM "MaterialLotEquipmentUse" u
  WHERE u."organizationId"=NEW."organizationId" AND u."materialLotId"=NEW."materialLotId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "MaterialRecallLot_capture_impact"
AFTER INSERT ON "MaterialRecallLot"
FOR EACH ROW EXECUTE FUNCTION capture_material_recall_impact();

CREATE OR REPLACE FUNCTION reject_material_recall_impact_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'MaterialRecallImpact is append-only'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "MaterialRecallImpact_append_only"
BEFORE UPDATE OR DELETE ON "MaterialRecallImpact"
FOR EACH ROW EXECUTE FUNCTION reject_material_recall_impact_mutation();