CREATE OR REPLACE FUNCTION guard_audit_finding_requirement() RETURNS trigger AS $$
DECLARE audit_program uuid; requirement_program uuid;
BEGIN
  IF NEW."requirementId" IS NOT NULL THEN
    SELECT "accreditationProgramId" INTO audit_program FROM "Audit" WHERE "organizationId"=NEW."organizationId" AND id=NEW."auditId";
    SELECT "accreditationProgramId" INTO requirement_program FROM "AccreditationRequirement" WHERE "organizationId"=NEW."organizationId" AND id=NEW."requirementId";
    IF audit_program IS NULL OR requirement_program IS NULL OR audit_program<>requirement_program THEN
      RAISE EXCEPTION 'Audit finding requirement must belong to the audit accreditation program';
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "AuditFinding_requirement_guard" BEFORE INSERT OR UPDATE OF "auditId","requirementId" ON "AuditFinding" FOR EACH ROW EXECUTE FUNCTION guard_audit_finding_requirement();

CREATE OR REPLACE FUNCTION guard_audit_status_transition() RETURNS trigger AS $$
DECLARE open_findings integer;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status='PLANNED' AND NEW.status IN ('IN_PROGRESS','CANCELLED')) OR
      (OLD.status='IN_PROGRESS' AND NEW.status IN ('COMPLETED','CANCELLED'))
    ) THEN RAISE EXCEPTION 'Invalid audit status transition'; END IF;
    IF NEW.status='COMPLETED' THEN
      SELECT count(*) INTO open_findings FROM "AuditFinding" WHERE "organizationId"=NEW."organizationId" AND "auditId"=NEW.id AND status<>'CLOSED';
      IF open_findings>0 THEN RAISE EXCEPTION 'Audit cannot complete while findings remain open'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
