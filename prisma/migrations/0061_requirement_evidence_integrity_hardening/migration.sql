CREATE OR REPLACE FUNCTION guard_requirement_assessment() RETURNS trigger AS $$
DECLARE evidence_count integer;
BEGIN
  IF NEW.outcome='COMPLIANT' THEN
    SELECT count(*) INTO evidence_count FROM "RequirementEvidence"
    WHERE "organizationId"=NEW."organizationId" AND "accreditationRequirementId"=NEW."accreditationRequirementId";
    IF evidence_count=0 THEN RAISE EXCEPTION 'COMPLIANT assessment requires mapped requirement evidence'; END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "RequirementAssessment_evidence_guard" BEFORE INSERT ON "RequirementAssessment" FOR EACH ROW EXECUTE FUNCTION guard_requirement_assessment();
