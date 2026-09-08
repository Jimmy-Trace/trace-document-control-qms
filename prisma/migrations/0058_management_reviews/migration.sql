CREATE TYPE "ManagementReviewStatus" AS ENUM ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED');
CREATE TYPE "ManagementReviewInputType" AS ENUM ('AUDIT_SUMMARY','QUALITY_METRICS','CAPA_STATUS','RISK_TRENDS','RESOURCE_NEEDS','CUSTOMER_FEEDBACK','OTHER');
CREATE TYPE "ManagementReviewActionStatus" AS ENUM ('OPEN','IN_PROGRESS','COMPLETED','CANCELLED');

CREATE TABLE "ManagementReview" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "reviewNumber" text NOT NULL,
  "title" text NOT NULL,
  "status" "ManagementReviewStatus" NOT NULL DEFAULT 'PLANNED',
  "scheduledAt" timestamptz(3),
  "startedAt" timestamptz(3),
  "completedAt" timestamptz(3),
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagementReview_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "ManagementReview_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ManagementReview_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "ManagementReview_org_number_key" UNIQUE ("organizationId","reviewNumber"),
  CONSTRAINT "ManagementReview_number_check" CHECK (length(btrim("reviewNumber"))>0),
  CONSTRAINT "ManagementReview_title_check" CHECK (length(btrim("title"))>0)
);

CREATE TABLE "ManagementReviewInput" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "managementReviewId" uuid NOT NULL,
  "inputType" "ManagementReviewInputType" NOT NULL,
  "summary" text NOT NULL,
  "evidenceFileId" uuid,
  "recordedByUserId" uuid NOT NULL,
  "recordedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagementReviewInput_review_fkey" FOREIGN KEY ("organizationId","managementReviewId") REFERENCES "ManagementReview"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ManagementReviewInput_file_fkey" FOREIGN KEY ("organizationId","evidenceFileId") REFERENCES "FileObject"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ManagementReviewInput_actor_fkey" FOREIGN KEY ("organizationId","recordedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ManagementReviewInput_summary_check" CHECK (length(btrim("summary"))>0)
);

CREATE TABLE "ManagementReviewDecision" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "managementReviewId" uuid NOT NULL,
  "decision" text NOT NULL,
  "rationale" text NOT NULL,
  "recordedByUserId" uuid NOT NULL,
  "recordedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagementReviewDecision_review_fkey" FOREIGN KEY ("organizationId","managementReviewId") REFERENCES "ManagementReview"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ManagementReviewDecision_actor_fkey" FOREIGN KEY ("organizationId","recordedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ManagementReviewDecision_decision_check" CHECK (length(btrim("decision"))>0),
  CONSTRAINT "ManagementReviewDecision_rationale_check" CHECK (length(btrim("rationale"))>0)
);

CREATE TABLE "ManagementReviewAction" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "managementReviewId" uuid NOT NULL,
  "description" text NOT NULL,
  "ownerUserId" uuid NOT NULL,
  "dueAt" timestamptz(3),
  "status" "ManagementReviewActionStatus" NOT NULL DEFAULT 'OPEN',
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" timestamptz(3),
  CONSTRAINT "ManagementReviewAction_review_fkey" FOREIGN KEY ("organizationId","managementReviewId") REFERENCES "ManagementReview"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ManagementReviewAction_owner_fkey" FOREIGN KEY ("organizationId","ownerUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ManagementReviewAction_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ManagementReviewAction_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "ManagementReviewAction_description_check" CHECK (length(btrim("description"))>0)
);

CREATE TABLE "ManagementReviewStatusChange" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "managementReviewId" uuid NOT NULL,
  "fromStatus" "ManagementReviewStatus" NOT NULL,
  "toStatus" "ManagementReviewStatus" NOT NULL,
  "reason" text NOT NULL,
  "actorUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagementReviewStatusChange_review_fkey" FOREIGN KEY ("organizationId","managementReviewId") REFERENCES "ManagementReview"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ManagementReviewStatusChange_actor_fkey" FOREIGN KEY ("organizationId","actorUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ManagementReviewStatusChange_reason_check" CHECK (length(btrim("reason"))>0)
);

CREATE TABLE "ManagementReviewActionStatusChange" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "managementReviewActionId" uuid NOT NULL,
  "fromStatus" "ManagementReviewActionStatus" NOT NULL,
  "toStatus" "ManagementReviewActionStatus" NOT NULL,
  "reason" text NOT NULL,
  "actorUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagementReviewActionStatusChange_action_fkey" FOREIGN KEY ("organizationId","managementReviewActionId") REFERENCES "ManagementReviewAction"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ManagementReviewActionStatusChange_actor_fkey" FOREIGN KEY ("organizationId","actorUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "ManagementReviewActionStatusChange_reason_check" CHECK (length(btrim("reason"))>0)
);

CREATE INDEX "ManagementReview_org_status_idx" ON "ManagementReview"("organizationId","status","scheduledAt");
CREATE INDEX "ManagementReviewInput_org_review_idx" ON "ManagementReviewInput"("organizationId","managementReviewId","recordedAt");
CREATE INDEX "ManagementReviewAction_org_status_idx" ON "ManagementReviewAction"("organizationId","status","dueAt");

CREATE OR REPLACE FUNCTION reject_management_review_evidence_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Management review evidence is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "ManagementReviewInput_append_only" BEFORE UPDATE OR DELETE ON "ManagementReviewInput" FOR EACH ROW EXECUTE FUNCTION reject_management_review_evidence_mutation();
CREATE TRIGGER "ManagementReviewDecision_append_only" BEFORE UPDATE OR DELETE ON "ManagementReviewDecision" FOR EACH ROW EXECUTE FUNCTION reject_management_review_evidence_mutation();
CREATE TRIGGER "ManagementReviewStatusChange_append_only" BEFORE UPDATE OR DELETE ON "ManagementReviewStatusChange" FOR EACH ROW EXECUTE FUNCTION reject_management_review_evidence_mutation();
CREATE TRIGGER "ManagementReviewActionStatusChange_append_only" BEFORE UPDATE OR DELETE ON "ManagementReviewActionStatusChange" FOR EACH ROW EXECUTE FUNCTION reject_management_review_evidence_mutation();

CREATE OR REPLACE FUNCTION guard_management_review_file() RETURNS trigger AS $$
DECLARE file_status "FileStatus";
BEGIN
  IF NEW."evidenceFileId" IS NOT NULL THEN
    SELECT status INTO file_status FROM "FileObject" WHERE "organizationId"=NEW."organizationId" AND id=NEW."evidenceFileId";
    IF file_status IS NULL OR file_status<>'AVAILABLE' THEN RAISE EXCEPTION 'Management review evidence file must be AVAILABLE'; END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "ManagementReviewInput_file_guard" BEFORE INSERT ON "ManagementReviewInput" FOR EACH ROW EXECUTE FUNCTION guard_management_review_file();

CREATE OR REPLACE FUNCTION guard_management_review_status() RETURNS trigger AS $$
DECLARE input_count integer; decision_count integer;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT ((OLD.status='PLANNED' AND NEW.status IN ('IN_PROGRESS','CANCELLED')) OR (OLD.status='IN_PROGRESS' AND NEW.status IN ('COMPLETED','CANCELLED'))) THEN
      RAISE EXCEPTION 'Invalid management review status transition';
    END IF;
    IF NEW.status='COMPLETED' THEN
      SELECT count(*) INTO input_count FROM "ManagementReviewInput" WHERE "organizationId"=NEW."organizationId" AND "managementReviewId"=NEW.id;
      SELECT count(*) INTO decision_count FROM "ManagementReviewDecision" WHERE "organizationId"=NEW."organizationId" AND "managementReviewId"=NEW.id;
      IF input_count=0 THEN RAISE EXCEPTION 'Management review requires at least one documented input before completion'; END IF;
      IF decision_count=0 THEN RAISE EXCEPTION 'Management review requires at least one documented decision before completion'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "ManagementReview_status_guard" BEFORE UPDATE OF status ON "ManagementReview" FOR EACH ROW EXECUTE FUNCTION guard_management_review_status();

CREATE OR REPLACE FUNCTION guard_management_review_action_status() RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status='OPEN' AND NEW.status IN ('IN_PROGRESS','COMPLETED','CANCELLED')) OR
    (OLD.status='IN_PROGRESS' AND NEW.status IN ('COMPLETED','CANCELLED'))
  ) THEN RAISE EXCEPTION 'Invalid management review action status transition'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "ManagementReviewAction_status_guard" BEFORE UPDATE OF status ON "ManagementReviewAction" FOR EACH ROW EXECUTE FUNCTION guard_management_review_action_status();

INSERT INTO "Permission" ("id","key","description") VALUES
  (gen_random_uuid(),'management_review.read','View management reviews'),
  (gen_random_uuid(),'management_review.manage','Create and manage management reviews')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."systemRole"=true AND r."name"='System Administrator' AND p."key" IN ('management_review.read','management_review.manage')
ON CONFLICT ("roleId","permissionId") DO NOTHING;
