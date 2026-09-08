CREATE TYPE "ValidationProjectStatus" AS ENUM ('DRAFT','IN_PROGRESS','COMPLETED','CANCELLED');
CREATE TYPE "ValidationResultOutcome" AS ENUM ('PASS','FAIL');

CREATE TABLE "ValidationProject" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "projectNumber" text NOT NULL,
  "laboratoryMethodId" uuid NOT NULL,
  "laboratoryMethodVersionId" uuid NOT NULL,
  "title" text NOT NULL,
  "objective" text NOT NULL,
  "status" "ValidationProjectStatus" NOT NULL DEFAULT 'DRAFT',
  "createdByUserId" uuid NOT NULL,
  "startedAt" timestamptz(3),
  "completedAt" timestamptz(3),
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ValidationProject_method_fkey" FOREIGN KEY ("organizationId","laboratoryMethodId") REFERENCES "LaboratoryMethod"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ValidationProject_method_version_fkey" FOREIGN KEY ("organizationId","laboratoryMethodVersionId") REFERENCES "LaboratoryMethodVersion"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ValidationProject_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ValidationProject_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "ValidationProject_org_number_key" UNIQUE ("organizationId","projectNumber"),
  CONSTRAINT "ValidationProject_number_check" CHECK (length(btrim("projectNumber"))>0),
  CONSTRAINT "ValidationProject_title_check" CHECK (length(btrim("title"))>0),
  CONSTRAINT "ValidationProject_objective_check" CHECK (length(btrim("objective"))>0)
);

CREATE TABLE "ValidationCriterion" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "validationProjectId" uuid NOT NULL,
  "criterionCode" text NOT NULL,
  "description" text NOT NULL,
  "acceptanceRule" text NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ValidationCriterion_project_fkey" FOREIGN KEY ("organizationId","validationProjectId") REFERENCES "ValidationProject"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ValidationCriterion_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "ValidationCriterion_org_project_code_key" UNIQUE ("organizationId","validationProjectId","criterionCode"),
  CONSTRAINT "ValidationCriterion_code_check" CHECK (length(btrim("criterionCode"))>0),
  CONSTRAINT "ValidationCriterion_description_check" CHECK (length(btrim("description"))>0),
  CONSTRAINT "ValidationCriterion_rule_check" CHECK (length(btrim("acceptanceRule"))>0)
);

CREATE TABLE "ValidationResult" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "validationProjectId" uuid NOT NULL,
  "validationCriterionId" uuid NOT NULL,
  "outcome" "ValidationResultOutcome" NOT NULL,
  "observedResult" text NOT NULL,
  "evidenceFileId" uuid,
  "recordedByUserId" uuid NOT NULL,
  "recordedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ValidationResult_project_fkey" FOREIGN KEY ("organizationId","validationProjectId") REFERENCES "ValidationProject"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ValidationResult_criterion_fkey" FOREIGN KEY ("organizationId","validationCriterionId") REFERENCES "ValidationCriterion"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ValidationResult_file_fkey" FOREIGN KEY ("organizationId","evidenceFileId") REFERENCES "FileObject"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ValidationResult_actor_fkey" FOREIGN KEY ("organizationId","recordedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ValidationResult_org_project_criterion_key" UNIQUE ("organizationId","validationProjectId","validationCriterionId"),
  CONSTRAINT "ValidationResult_observed_check" CHECK (length(btrim("observedResult"))>0)
);

CREATE TABLE "ValidationProjectActionEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "validationProjectId" uuid NOT NULL,
  "action" text NOT NULL,
  "fromStatus" "ValidationProjectStatus" NOT NULL,
  "toStatus" "ValidationProjectStatus" NOT NULL,
  "reason" text NOT NULL,
  "actorUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ValidationProjectActionEvent_project_fkey" FOREIGN KEY ("organizationId","validationProjectId") REFERENCES "ValidationProject"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ValidationProjectActionEvent_actor_fkey" FOREIGN KEY ("organizationId","actorUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ValidationProjectActionEvent_action_check" CHECK (length(btrim("action"))>0),
  CONSTRAINT "ValidationProjectActionEvent_reason_check" CHECK (length(btrim("reason"))>0)
);

CREATE INDEX "ValidationProject_org_status_idx" ON "ValidationProject"("organizationId","status");
CREATE INDEX "ValidationProject_org_method_idx" ON "ValidationProject"("organizationId","laboratoryMethodId","createdAt" DESC);
CREATE INDEX "ValidationCriterion_org_project_idx" ON "ValidationCriterion"("organizationId","validationProjectId");
CREATE INDEX "ValidationResult_org_project_idx" ON "ValidationResult"("organizationId","validationProjectId");
CREATE INDEX "ValidationProjectActionEvent_org_project_idx" ON "ValidationProjectActionEvent"("organizationId","validationProjectId","createdAt" DESC);

CREATE OR REPLACE FUNCTION reject_validation_evidence_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Validation evidence is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "ValidationCriterion_append_only" BEFORE UPDATE OR DELETE ON "ValidationCriterion" FOR EACH ROW EXECUTE FUNCTION reject_validation_evidence_mutation();
CREATE TRIGGER "ValidationResult_append_only" BEFORE UPDATE OR DELETE ON "ValidationResult" FOR EACH ROW EXECUTE FUNCTION reject_validation_evidence_mutation();
CREATE TRIGGER "ValidationProjectActionEvent_append_only" BEFORE UPDATE OR DELETE ON "ValidationProjectActionEvent" FOR EACH ROW EXECUTE FUNCTION reject_validation_evidence_mutation();

CREATE OR REPLACE FUNCTION guard_validation_project_method_version() RETURNS trigger AS $$
DECLARE version_method uuid;
BEGIN
  SELECT "laboratoryMethodId" INTO version_method FROM "LaboratoryMethodVersion" WHERE "organizationId"=NEW."organizationId" AND id=NEW."laboratoryMethodVersionId";
  IF version_method IS NULL OR version_method<>NEW."laboratoryMethodId" THEN RAISE EXCEPTION 'Validation project method version must belong to the selected method'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "ValidationProject_method_version_guard" BEFORE INSERT OR UPDATE OF "laboratoryMethodId","laboratoryMethodVersionId" ON "ValidationProject" FOR EACH ROW EXECUTE FUNCTION guard_validation_project_method_version();

CREATE OR REPLACE FUNCTION guard_validation_result_criterion_project() RETURNS trigger AS $$
DECLARE criterion_project uuid; file_status "FileStatus";
BEGIN
  SELECT "validationProjectId" INTO criterion_project FROM "ValidationCriterion" WHERE "organizationId"=NEW."organizationId" AND id=NEW."validationCriterionId";
  IF criterion_project IS NULL OR criterion_project<>NEW."validationProjectId" THEN RAISE EXCEPTION 'Validation criterion does not belong to validation project'; END IF;
  IF NEW."evidenceFileId" IS NOT NULL THEN
    SELECT status INTO file_status FROM "FileObject" WHERE "organizationId"=NEW."organizationId" AND id=NEW."evidenceFileId";
    IF file_status IS NULL OR file_status<>'AVAILABLE' THEN RAISE EXCEPTION 'Validation evidence file must be AVAILABLE'; END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "ValidationResult_criterion_project_guard" BEFORE INSERT ON "ValidationResult" FOR EACH ROW EXECUTE FUNCTION guard_validation_result_criterion_project();

CREATE OR REPLACE FUNCTION guard_validation_project_status() RETURNS trigger AS $$
DECLARE criteria_count integer; results_count integer; fail_count integer;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT ((OLD.status='DRAFT' AND NEW.status IN ('IN_PROGRESS','CANCELLED')) OR (OLD.status='IN_PROGRESS' AND NEW.status IN ('COMPLETED','CANCELLED'))) THEN
      RAISE EXCEPTION 'Invalid validation project status transition';
    END IF;
    IF NEW.status='IN_PROGRESS' THEN
      SELECT count(*) INTO criteria_count FROM "ValidationCriterion" WHERE "organizationId"=NEW."organizationId" AND "validationProjectId"=NEW.id;
      IF criteria_count=0 THEN RAISE EXCEPTION 'Validation project requires at least one criterion before start'; END IF;
    END IF;
    IF NEW.status='COMPLETED' THEN
      SELECT count(*) INTO criteria_count FROM "ValidationCriterion" WHERE "organizationId"=NEW."organizationId" AND "validationProjectId"=NEW.id;
      SELECT count(*),count(*) FILTER (WHERE outcome='FAIL') INTO results_count,fail_count FROM "ValidationResult" WHERE "organizationId"=NEW."organizationId" AND "validationProjectId"=NEW.id;
      IF criteria_count=0 OR results_count<>criteria_count THEN RAISE EXCEPTION 'Every validation criterion requires a result before completion'; END IF;
      IF fail_count>0 THEN RAISE EXCEPTION 'Validation project cannot complete with failed criteria'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "ValidationProject_status_guard" BEFORE UPDATE OF status ON "ValidationProject" FOR EACH ROW EXECUTE FUNCTION guard_validation_project_status();

CREATE OR REPLACE FUNCTION allow_validation_backed_lab_activation() RETURNS trigger AS $$
DECLARE project_count integer;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status='ACTIVE' THEN
    SELECT count(*) INTO project_count FROM "ValidationProject" vp
    WHERE vp."organizationId"=NEW."organizationId" AND vp."laboratoryMethodId"=NEW.id AND vp.status='COMPLETED';
    IF project_count=0 THEN RAISE EXCEPTION 'Laboratory method activation requires a completed passing validation project'; END IF;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT ((OLD.status='DRAFT' AND NEW.status IN ('ACTIVE','RETIRED')) OR (OLD.status='ACTIVE' AND NEW.status='RETIRED')) THEN
    RAISE EXCEPTION 'Invalid laboratory method status transition';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "LaboratoryMethod_status_guard" ON "LaboratoryMethod";
DROP FUNCTION IF EXISTS guard_lab_method_status();
CREATE TRIGGER "LaboratoryMethod_status_guard" BEFORE UPDATE OF status ON "LaboratoryMethod" FOR EACH ROW EXECUTE FUNCTION allow_validation_backed_lab_activation();

CREATE OR REPLACE FUNCTION allow_test_activation_with_active_method() RETURNS trigger AS $$
DECLARE active_methods integer;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status='ACTIVE' THEN
    SELECT count(*) INTO active_methods FROM "LaboratoryMethod" WHERE "organizationId"=NEW."organizationId" AND "laboratoryTestId"=NEW.id AND status='ACTIVE';
    IF active_methods=0 THEN RAISE EXCEPTION 'Laboratory test activation requires at least one active validated method'; END IF;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT ((OLD.status='DRAFT' AND NEW.status IN ('ACTIVE','RETIRED')) OR (OLD.status='ACTIVE' AND NEW.status='RETIRED')) THEN
    RAISE EXCEPTION 'Invalid laboratory test status transition';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "LaboratoryTest_status_guard" ON "LaboratoryTest";
DROP FUNCTION IF EXISTS guard_lab_test_status();
CREATE TRIGGER "LaboratoryTest_status_guard" BEFORE UPDATE OF status ON "LaboratoryTest" FOR EACH ROW EXECUTE FUNCTION allow_test_activation_with_active_method();
