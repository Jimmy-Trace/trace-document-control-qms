CREATE OR REPLACE FUNCTION guard_management_review_input_insert() RETURNS trigger AS $$
DECLARE review_status "ManagementReviewStatus";
BEGIN
  SELECT status INTO review_status FROM "ManagementReview" WHERE "organizationId"=NEW."organizationId" AND id=NEW."managementReviewId" FOR UPDATE;
  IF review_status IS NULL OR review_status NOT IN ('PLANNED','IN_PROGRESS') THEN RAISE EXCEPTION 'Management review input requires PLANNED or IN_PROGRESS review'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "ManagementReviewInput_status_guard" BEFORE INSERT ON "ManagementReviewInput" FOR EACH ROW EXECUTE FUNCTION guard_management_review_input_insert();

CREATE OR REPLACE FUNCTION guard_management_review_decision_insert() RETURNS trigger AS $$
DECLARE review_status "ManagementReviewStatus";
BEGIN
  SELECT status INTO review_status FROM "ManagementReview" WHERE "organizationId"=NEW."organizationId" AND id=NEW."managementReviewId" FOR UPDATE;
  IF review_status IS NULL OR review_status<>'IN_PROGRESS' THEN RAISE EXCEPTION 'Management review decision requires IN_PROGRESS review'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "ManagementReviewDecision_status_guard" BEFORE INSERT ON "ManagementReviewDecision" FOR EACH ROW EXECUTE FUNCTION guard_management_review_decision_insert();

CREATE OR REPLACE FUNCTION guard_management_review_action_insert() RETURNS trigger AS $$
DECLARE review_status "ManagementReviewStatus"; owner_status "UserStatus";
BEGIN
  SELECT status INTO review_status FROM "ManagementReview" WHERE "organizationId"=NEW."organizationId" AND id=NEW."managementReviewId" FOR UPDATE;
  IF review_status IS NULL OR review_status<>'IN_PROGRESS' THEN RAISE EXCEPTION 'Management review action requires IN_PROGRESS review'; END IF;
  SELECT status INTO owner_status FROM "User" WHERE "organizationId"=NEW."organizationId" AND id=NEW."ownerUserId";
  IF owner_status IS NULL OR owner_status<>'ACTIVE' THEN RAISE EXCEPTION 'Management review action owner must be ACTIVE'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "ManagementReviewAction_insert_guard" BEFORE INSERT ON "ManagementReviewAction" FOR EACH ROW EXECUTE FUNCTION guard_management_review_action_insert();
