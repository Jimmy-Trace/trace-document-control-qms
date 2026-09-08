CREATE TYPE "ProficiencyTestingProgramStatus" AS ENUM ('ACTIVE','INACTIVE');
CREATE TYPE "ProficiencyTestingEventStatus" AS ENUM ('SCHEDULED','OPEN','SUBMITTED','SCORED','CLOSED','CANCELLED');
CREATE TYPE "ProficiencyTestingOutcome" AS ENUM ('SATISFACTORY','UNSATISFACTORY');

CREATE TABLE "ProficiencyTestingProgram" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "programCode" text NOT NULL,
  "providerName" text NOT NULL,
  "laboratoryTestId" uuid NOT NULL,
  "laboratoryMethodId" uuid NOT NULL,
  "status" "ProficiencyTestingProgramStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProficiencyTestingProgram_test_fkey" FOREIGN KEY ("organizationId","laboratoryTestId") REFERENCES "LaboratoryTest"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ProficiencyTestingProgram_method_fkey" FOREIGN KEY ("organizationId","laboratoryMethodId") REFERENCES "LaboratoryMethod"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ProficiencyTestingProgram_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ProficiencyTestingProgram_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "ProficiencyTestingProgram_org_code_key" UNIQUE ("organizationId","programCode"),
  CONSTRAINT "ProficiencyTestingProgram_code_check" CHECK (length(btrim("programCode"))>0),
  CONSTRAINT "ProficiencyTestingProgram_provider_check" CHECK (length(btrim("providerName"))>0)
);

CREATE TABLE "ProficiencyTestingEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "proficiencyTestingProgramId" uuid NOT NULL,
  "eventCode" text NOT NULL,
  "laboratoryMethodVersionId" uuid NOT NULL,
  "dueAt" timestamptz(3),
  "status" "ProficiencyTestingEventStatus" NOT NULL DEFAULT 'SCHEDULED',
  "createdByUserId" uuid NOT NULL,
  "openedAt" timestamptz(3),
  "submittedAt" timestamptz(3),
  "scoredAt" timestamptz(3),
  "closedAt" timestamptz(3),
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProficiencyTestingEvent_program_fkey" FOREIGN KEY ("organizationId","proficiencyTestingProgramId") REFERENCES "ProficiencyTestingProgram"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ProficiencyTestingEvent_version_fkey" FOREIGN KEY ("organizationId","laboratoryMethodVersionId") REFERENCES "LaboratoryMethodVersion"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ProficiencyTestingEvent_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ProficiencyTestingEvent_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "ProficiencyTestingEvent_org_program_code_key" UNIQUE ("organizationId","proficiencyTestingProgramId","eventCode"),
  CONSTRAINT "ProficiencyTestingEvent_code_check" CHECK (length(btrim("eventCode"))>0)
);

CREATE TABLE "ProficiencyTestingSubmission" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "proficiencyTestingEventId" uuid NOT NULL,
  "reportedResult" text NOT NULL,
  "evidenceFileId" uuid,
  "submittedByUserId" uuid NOT NULL,
  "submittedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProficiencyTestingSubmission_event_fkey" FOREIGN KEY ("organizationId","proficiencyTestingEventId") REFERENCES "ProficiencyTestingEvent"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ProficiencyTestingSubmission_file_fkey" FOREIGN KEY ("organizationId","evidenceFileId") REFERENCES "FileObject"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ProficiencyTestingSubmission_actor_fkey" FOREIGN KEY ("organizationId","submittedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ProficiencyTestingSubmission_org_event_key" UNIQUE ("organizationId","proficiencyTestingEventId"),
  CONSTRAINT "ProficiencyTestingSubmission_result_check" CHECK (length(btrim("reportedResult"))>0)
);

CREATE TABLE "ProficiencyTestingScore" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "proficiencyTestingEventId" uuid NOT NULL,
  "outcome" "ProficiencyTestingOutcome" NOT NULL,
  "scoreSummary" text NOT NULL,
  "evidenceFileId" uuid,
  "scoredByUserId" uuid NOT NULL,
  "scoredAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProficiencyTestingScore_event_fkey" FOREIGN KEY ("organizationId","proficiencyTestingEventId") REFERENCES "ProficiencyTestingEvent"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ProficiencyTestingScore_file_fkey" FOREIGN KEY ("organizationId","evidenceFileId") REFERENCES "FileObject"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ProficiencyTestingScore_actor_fkey" FOREIGN KEY ("organizationId","scoredByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ProficiencyTestingScore_org_event_key" UNIQUE ("organizationId","proficiencyTestingEventId"),
  CONSTRAINT "ProficiencyTestingScore_summary_check" CHECK (length(btrim("scoreSummary"))>0)
);

CREATE TABLE "ProficiencyTestingFollowUp" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "proficiencyTestingEventId" uuid NOT NULL,
  "description" text NOT NULL,
  "evidenceFileId" uuid,
  "recordedByUserId" uuid NOT NULL,
  "recordedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProficiencyTestingFollowUp_event_fkey" FOREIGN KEY ("organizationId","proficiencyTestingEventId") REFERENCES "ProficiencyTestingEvent"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ProficiencyTestingFollowUp_file_fkey" FOREIGN KEY ("organizationId","evidenceFileId") REFERENCES "FileObject"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ProficiencyTestingFollowUp_actor_fkey" FOREIGN KEY ("organizationId","recordedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ProficiencyTestingFollowUp_description_check" CHECK (length(btrim("description"))>0)
);

CREATE TABLE "ProficiencyTestingEventAction" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "proficiencyTestingEventId" uuid NOT NULL,
  "fromStatus" "ProficiencyTestingEventStatus" NOT NULL,
  "toStatus" "ProficiencyTestingEventStatus" NOT NULL,
  "reason" text NOT NULL,
  "actorUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProficiencyTestingEventAction_event_fkey" FOREIGN KEY ("organizationId","proficiencyTestingEventId") REFERENCES "ProficiencyTestingEvent"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ProficiencyTestingEventAction_actor_fkey" FOREIGN KEY ("organizationId","actorUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ProficiencyTestingEventAction_reason_check" CHECK (length(btrim("reason"))>0)
);

CREATE INDEX "PTProgram_org_status_idx" ON "ProficiencyTestingProgram"("organizationId","status");
CREATE INDEX "PTEvent_org_status_idx" ON "ProficiencyTestingEvent"("organizationId","status","dueAt");
CREATE INDEX "PTFollowUp_org_event_idx" ON "ProficiencyTestingFollowUp"("organizationId","proficiencyTestingEventId","recordedAt" DESC);
CREATE INDEX "PTEventAction_org_event_idx" ON "ProficiencyTestingEventAction"("organizationId","proficiencyTestingEventId","createdAt" DESC);

CREATE OR REPLACE FUNCTION reject_proficiency_testing_evidence_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Proficiency testing evidence is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "PTSubmission_append_only" BEFORE UPDATE OR DELETE ON "ProficiencyTestingSubmission" FOR EACH ROW EXECUTE FUNCTION reject_proficiency_testing_evidence_mutation();
CREATE TRIGGER "PTScore_append_only" BEFORE UPDATE OR DELETE ON "ProficiencyTestingScore" FOR EACH ROW EXECUTE FUNCTION reject_proficiency_testing_evidence_mutation();
CREATE TRIGGER "PTFollowUp_append_only" BEFORE UPDATE OR DELETE ON "ProficiencyTestingFollowUp" FOR EACH ROW EXECUTE FUNCTION reject_proficiency_testing_evidence_mutation();
CREATE TRIGGER "PTEventAction_append_only" BEFORE UPDATE OR DELETE ON "ProficiencyTestingEventAction" FOR EACH ROW EXECUTE FUNCTION reject_proficiency_testing_evidence_mutation();

CREATE OR REPLACE FUNCTION guard_pt_program_method() RETURNS trigger AS $$
DECLARE method_test uuid;
BEGIN
  SELECT "laboratoryTestId" INTO method_test FROM "LaboratoryMethod" WHERE "organizationId"=NEW."organizationId" AND id=NEW."laboratoryMethodId";
  IF method_test IS NULL OR method_test<>NEW."laboratoryTestId" THEN RAISE EXCEPTION 'PT program method must belong to selected test'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "PTProgram_method_guard" BEFORE INSERT OR UPDATE OF "laboratoryTestId","laboratoryMethodId" ON "ProficiencyTestingProgram" FOR EACH ROW EXECUTE FUNCTION guard_pt_program_method();

CREATE OR REPLACE FUNCTION guard_pt_event_method_version() RETURNS trigger AS $$
DECLARE program_method uuid; version_method uuid;
BEGIN
  SELECT "laboratoryMethodId" INTO program_method FROM "ProficiencyTestingProgram" WHERE "organizationId"=NEW."organizationId" AND id=NEW."proficiencyTestingProgramId";
  SELECT "laboratoryMethodId" INTO version_method FROM "LaboratoryMethodVersion" WHERE "organizationId"=NEW."organizationId" AND id=NEW."laboratoryMethodVersionId";
  IF program_method IS NULL OR version_method IS NULL OR program_method<>version_method THEN RAISE EXCEPTION 'PT event method version must belong to the program method'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "PTEvent_method_version_guard" BEFORE INSERT OR UPDATE OF "proficiencyTestingProgramId","laboratoryMethodVersionId" ON "ProficiencyTestingEvent" FOR EACH ROW EXECUTE FUNCTION guard_pt_event_method_version();

CREATE OR REPLACE FUNCTION guard_pt_available_file() RETURNS trigger AS $$
DECLARE file_status "FileStatus";
BEGIN
  IF NEW."evidenceFileId" IS NOT NULL THEN
    SELECT status INTO file_status FROM "FileObject" WHERE "organizationId"=NEW."organizationId" AND id=NEW."evidenceFileId";
    IF file_status IS NULL OR file_status<>'AVAILABLE' THEN RAISE EXCEPTION 'PT evidence file must be AVAILABLE'; END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "PTSubmission_file_guard" BEFORE INSERT ON "ProficiencyTestingSubmission" FOR EACH ROW EXECUTE FUNCTION guard_pt_available_file();
CREATE TRIGGER "PTScore_file_guard" BEFORE INSERT ON "ProficiencyTestingScore" FOR EACH ROW EXECUTE FUNCTION guard_pt_available_file();
CREATE TRIGGER "PTFollowUp_file_guard" BEFORE INSERT ON "ProficiencyTestingFollowUp" FOR EACH ROW EXECUTE FUNCTION guard_pt_available_file();

CREATE OR REPLACE FUNCTION guard_pt_event_status() RETURNS trigger AS $$
DECLARE submission_count integer; score_count integer; outcome "ProficiencyTestingOutcome"; followup_count integer;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT ((OLD.status='SCHEDULED' AND NEW.status IN ('OPEN','CANCELLED')) OR (OLD.status='OPEN' AND NEW.status IN ('SUBMITTED','CANCELLED')) OR (OLD.status='SUBMITTED' AND NEW.status='SCORED') OR (OLD.status='SCORED' AND NEW.status='CLOSED')) THEN
      RAISE EXCEPTION 'Invalid proficiency testing event status transition';
    END IF;
    IF NEW.status='SUBMITTED' THEN
      SELECT count(*) INTO submission_count FROM "ProficiencyTestingSubmission" WHERE "organizationId"=NEW."organizationId" AND "proficiencyTestingEventId"=NEW.id;
      IF submission_count<>1 THEN RAISE EXCEPTION 'PT event requires exactly one submission before SUBMITTED'; END IF;
    END IF;
    IF NEW.status='SCORED' THEN
      SELECT count(*) INTO score_count FROM "ProficiencyTestingScore" WHERE "organizationId"=NEW."organizationId" AND "proficiencyTestingEventId"=NEW.id;
      IF score_count<>1 THEN RAISE EXCEPTION 'PT event requires exactly one score before SCORED'; END IF;
    END IF;
    IF NEW.status='CLOSED' THEN
      SELECT outcome INTO outcome FROM "ProficiencyTestingScore" WHERE "organizationId"=NEW."organizationId" AND "proficiencyTestingEventId"=NEW.id;
      IF outcome IS NULL THEN RAISE EXCEPTION 'PT event requires a score before closure'; END IF;
      IF outcome='UNSATISFACTORY' THEN
        SELECT count(*) INTO followup_count FROM "ProficiencyTestingFollowUp" WHERE "organizationId"=NEW."organizationId" AND "proficiencyTestingEventId"=NEW.id;
        IF followup_count=0 THEN RAISE EXCEPTION 'Unsatisfactory PT outcome requires documented follow-up before closure'; END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "PTEvent_status_guard" BEFORE UPDATE OF status ON "ProficiencyTestingEvent" FOR EACH ROW EXECUTE FUNCTION guard_pt_event_status();
