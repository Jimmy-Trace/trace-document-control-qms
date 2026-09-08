CREATE TYPE "RequirementEvidenceType" AS ENUM ('POLICY','PROCEDURE','RECORD','REPORT','AUDIT_EVIDENCE','MANAGEMENT_REVIEW','OTHER');
CREATE TYPE "RequirementAssessmentOutcome" AS ENUM ('NOT_ASSESSED','COMPLIANT','PARTIALLY_COMPLIANT','NONCOMPLIANT');

CREATE TABLE "RequirementEvidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "accreditationRequirementId" uuid NOT NULL,
  "evidenceFileId" uuid NOT NULL,
  "evidenceType" "RequirementEvidenceType" NOT NULL,
  "description" text NOT NULL,
  "effectiveAt" timestamptz(3),
  "expiresAt" timestamptz(3),
  "recordedByUserId" uuid NOT NULL,
  "recordedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RequirementEvidence_requirement_fkey" FOREIGN KEY ("organizationId","accreditationRequirementId") REFERENCES "AccreditationRequirement"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "RequirementEvidence_file_fkey" FOREIGN KEY ("organizationId","evidenceFileId") REFERENCES "FileObject"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "RequirementEvidence_actor_fkey" FOREIGN KEY ("organizationId","recordedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "RequirementEvidence_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "RequirementEvidence_description_check" CHECK (length(btrim("description"))>0),
  CONSTRAINT "RequirementEvidence_dates_check" CHECK ("expiresAt" IS NULL OR "effectiveAt" IS NULL OR "expiresAt">="effectiveAt")
);

CREATE TABLE "RequirementAssessment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "accreditationRequirementId" uuid NOT NULL,
  "outcome" "RequirementAssessmentOutcome" NOT NULL,
  "rationale" text NOT NULL,
  "assessedByUserId" uuid NOT NULL,
  "assessedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RequirementAssessment_requirement_fkey" FOREIGN KEY ("organizationId","accreditationRequirementId") REFERENCES "AccreditationRequirement"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "RequirementAssessment_actor_fkey" FOREIGN KEY ("organizationId","assessedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "RequirementAssessment_rationale_check" CHECK (length(btrim("rationale"))>0)
);

CREATE INDEX "RequirementEvidence_org_requirement_idx" ON "RequirementEvidence"("organizationId","accreditationRequirementId","recordedAt" DESC);
CREATE INDEX "RequirementAssessment_org_requirement_idx" ON "RequirementAssessment"("organizationId","accreditationRequirementId","assessedAt" DESC);

CREATE OR REPLACE FUNCTION reject_requirement_evidence_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Requirement evidence and assessments are append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "RequirementEvidence_append_only" BEFORE UPDATE OR DELETE ON "RequirementEvidence" FOR EACH ROW EXECUTE FUNCTION reject_requirement_evidence_mutation();
CREATE TRIGGER "RequirementAssessment_append_only" BEFORE UPDATE OR DELETE ON "RequirementAssessment" FOR EACH ROW EXECUTE FUNCTION reject_requirement_evidence_mutation();

CREATE OR REPLACE FUNCTION guard_requirement_evidence_file() RETURNS trigger AS $$
DECLARE file_status "FileStatus";
BEGIN
  SELECT status INTO file_status FROM "FileObject" WHERE "organizationId"=NEW."organizationId" AND id=NEW."evidenceFileId";
  IF file_status IS NULL OR file_status<>'AVAILABLE' THEN RAISE EXCEPTION 'Requirement evidence file must be AVAILABLE'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "RequirementEvidence_file_guard" BEFORE INSERT ON "RequirementEvidence" FOR EACH ROW EXECUTE FUNCTION guard_requirement_evidence_file();

INSERT INTO "Permission" ("id","key","description") VALUES
  (gen_random_uuid(),'requirement_evidence.read','View accreditation requirement evidence and assessments'),
  (gen_random_uuid(),'requirement_evidence.manage','Map evidence and assess accreditation requirements')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."systemRole"=true AND r."name"='System Administrator' AND p."key" IN ('requirement_evidence.read','requirement_evidence.manage')
ON CONFLICT ("roleId","permissionId") DO NOTHING;
