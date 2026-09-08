CREATE OR REPLACE FUNCTION guard_pt_submission_insert() RETURNS trigger AS $$
DECLARE event_status "ProficiencyTestingEventStatus";
BEGIN
  SELECT status INTO event_status FROM "ProficiencyTestingEvent" WHERE "organizationId"=NEW."organizationId" AND id=NEW."proficiencyTestingEventId" FOR UPDATE;
  IF event_status IS NULL OR event_status<>'OPEN' THEN RAISE EXCEPTION 'PT submission requires an OPEN event'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "PTSubmission_event_status_guard" BEFORE INSERT ON "ProficiencyTestingSubmission" FOR EACH ROW EXECUTE FUNCTION guard_pt_submission_insert();

CREATE OR REPLACE FUNCTION guard_pt_score_insert() RETURNS trigger AS $$
DECLARE event_status "ProficiencyTestingEventStatus"; submission_count integer;
BEGIN
  SELECT status INTO event_status FROM "ProficiencyTestingEvent" WHERE "organizationId"=NEW."organizationId" AND id=NEW."proficiencyTestingEventId" FOR UPDATE;
  IF event_status IS NULL OR event_status<>'SUBMITTED' THEN RAISE EXCEPTION 'PT score requires a SUBMITTED event'; END IF;
  SELECT count(*) INTO submission_count FROM "ProficiencyTestingSubmission" WHERE "organizationId"=NEW."organizationId" AND "proficiencyTestingEventId"=NEW."proficiencyTestingEventId";
  IF submission_count<>1 THEN RAISE EXCEPTION 'PT score requires exactly one immutable submission'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "PTScore_event_status_guard" BEFORE INSERT ON "ProficiencyTestingScore" FOR EACH ROW EXECUTE FUNCTION guard_pt_score_insert();

CREATE OR REPLACE FUNCTION guard_pt_followup_insert() RETURNS trigger AS $$
DECLARE event_status "ProficiencyTestingEventStatus"; event_outcome "ProficiencyTestingOutcome";
BEGIN
  SELECT status INTO event_status FROM "ProficiencyTestingEvent" WHERE "organizationId"=NEW."organizationId" AND id=NEW."proficiencyTestingEventId";
  SELECT s.outcome INTO event_outcome FROM "ProficiencyTestingScore" s WHERE s."organizationId"=NEW."organizationId" AND s."proficiencyTestingEventId"=NEW."proficiencyTestingEventId";
  IF event_status IS NULL OR event_status<>'SCORED' THEN RAISE EXCEPTION 'PT follow-up requires a SCORED event'; END IF;
  IF event_outcome IS NULL THEN RAISE EXCEPTION 'PT follow-up requires scoring evidence'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "PTFollowUp_event_status_guard" BEFORE INSERT ON "ProficiencyTestingFollowUp" FOR EACH ROW EXECUTE FUNCTION guard_pt_followup_insert();

CREATE OR REPLACE FUNCTION guard_pt_event_status() RETURNS trigger AS $$
DECLARE submission_count integer; score_count integer; event_outcome "ProficiencyTestingOutcome"; followup_count integer;
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
      SELECT s.outcome INTO event_outcome FROM "ProficiencyTestingScore" s WHERE s."organizationId"=NEW."organizationId" AND s."proficiencyTestingEventId"=NEW.id;
      IF event_outcome IS NULL THEN RAISE EXCEPTION 'PT event requires a score before closure'; END IF;
      IF event_outcome='UNSATISFACTORY' THEN
        SELECT count(*) INTO followup_count FROM "ProficiencyTestingFollowUp" WHERE "organizationId"=NEW."organizationId" AND "proficiencyTestingEventId"=NEW.id;
        IF followup_count=0 THEN RAISE EXCEPTION 'Unsatisfactory PT outcome requires documented follow-up before closure'; END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
