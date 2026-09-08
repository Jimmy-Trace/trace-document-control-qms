CREATE TYPE "AccreditationProgramStatus" AS ENUM ('ACTIVE','INACTIVE');
CREATE TYPE "AuditStatus" AS ENUM ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED');
CREATE TYPE "AuditFindingSeverity" AS ENUM ('OBSERVATION','MINOR','MAJOR','CRITICAL');
CREATE TYPE "AuditFindingStatus" AS ENUM ('OPEN','UNDER_REVIEW','CLOSED');

CREATE TABLE "AccreditationProgram" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "programCode" text NOT NULL,
  "name" text NOT NULL,
  "authorityName" text NOT NULL,
  "status" "AccreditationProgramStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccreditationProgram_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "AccreditationProgram_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AccreditationProgram_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "AccreditationProgram_org_code_key" UNIQUE ("organizationId","programCode"),
  CONSTRAINT "AccreditationProgram_code_check" CHECK (length(btrim("programCode"))>0),
  CONSTRAINT "AccreditationProgram_name_check" CHECK (length(btrim("name"))>0),
  CONSTRAINT "AccreditationProgram_authority_check" CHECK (length(btrim("authorityName"))>0)
);

CREATE TABLE "AccreditationRequirement" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "accreditationProgramId" uuid NOT NULL,
  "requirementCode" text NOT NULL,
  "title" text NOT NULL,
  "requirementText" text NOT NULL,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccreditationRequirement_program_fkey" FOREIGN KEY ("organizationId","accreditationProgramId") REFERENCES "AccreditationProgram"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AccreditationRequirement_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AccreditationRequirement_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "AccreditationRequirement_program_code_key" UNIQUE ("organizationId","accreditationProgramId","requirementCode"),
  CONSTRAINT "AccreditationRequirement_code_check" CHECK (length(btrim("requirementCode"))>0),
  CONSTRAINT "AccreditationRequirement_title_check" CHECK (length(btrim("title"))>0),
  CONSTRAINT "AccreditationRequirement_text_check" CHECK (length(btrim("requirementText"))>0)
);

CREATE TABLE "Audit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "auditNumber" text NOT NULL,
  "title" text NOT NULL,
  "scope" text NOT NULL,
  "accreditationProgramId" uuid,
  "status" "AuditStatus" NOT NULL DEFAULT 'PLANNED',
  "scheduledStartAt" timestamptz(3),
  "startedAt" timestamptz(3),
  "completedAt" timestamptz(3),
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Audit_program_fkey" FOREIGN KEY ("organizationId","accreditationProgramId") REFERENCES "AccreditationProgram"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "Audit_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "Audit_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "Audit_org_number_key" UNIQUE ("organizationId","auditNumber"),
  CONSTRAINT "Audit_number_check" CHECK (length(btrim("auditNumber"))>0),
  CONSTRAINT "Audit_title_check" CHECK (length(btrim("title"))>0),
  CONSTRAINT "Audit_scope_check" CHECK (length(btrim("scope"))>0)
);

CREATE TABLE "AuditFinding" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "auditId" uuid NOT NULL,
  "findingNumber" text NOT NULL,
  "severity" "AuditFindingSeverity" NOT NULL,
  "status" "AuditFindingStatus" NOT NULL DEFAULT 'OPEN',
  "description" text NOT NULL,
  "requirementId" uuid,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" timestamptz(3),
  CONSTRAINT "AuditFinding_audit_fkey" FOREIGN KEY ("organizationId","auditId") REFERENCES "Audit"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AuditFinding_requirement_fkey" FOREIGN KEY ("organizationId","requirementId") REFERENCES "AccreditationRequirement"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AuditFinding_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AuditFinding_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "AuditFinding_audit_number_key" UNIQUE ("organizationId","auditId","findingNumber"),
  CONSTRAINT "AuditFinding_number_check" CHECK (length(btrim("findingNumber"))>0),
  CONSTRAINT "AuditFinding_description_check" CHECK (length(btrim("description"))>0)
);

CREATE TABLE "AuditStatusChange" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "auditId" uuid NOT NULL,
  "fromStatus" "AuditStatus" NOT NULL,
  "toStatus" "AuditStatus" NOT NULL,
  "reason" text NOT NULL,
  "actorUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditStatusChange_audit_fkey" FOREIGN KEY ("organizationId","auditId") REFERENCES "Audit"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AuditStatusChange_actor_fkey" FOREIGN KEY ("organizationId","actorUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AuditStatusChange_reason_check" CHECK (length(btrim("reason"))>0)
);

CREATE TABLE "AuditFindingStatusChange" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "auditFindingId" uuid NOT NULL,
  "fromStatus" "AuditFindingStatus" NOT NULL,
  "toStatus" "AuditFindingStatus" NOT NULL,
  "reason" text NOT NULL,
  "actorUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditFindingStatusChange_finding_fkey" FOREIGN KEY ("organizationId","auditFindingId") REFERENCES "AuditFinding"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AuditFindingStatusChange_actor_fkey" FOREIGN KEY ("organizationId","actorUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "AuditFindingStatusChange_reason_check" CHECK (length(btrim("reason"))>0)
);

CREATE INDEX "AccreditationProgram_org_status_idx" ON "AccreditationProgram"("organizationId","status");
CREATE INDEX "AccreditationRequirement_org_program_idx" ON "AccreditationRequirement"("organizationId","accreditationProgramId");
CREATE INDEX "Audit_org_status_idx" ON "Audit"("organizationId","status","scheduledStartAt");
CREATE INDEX "AuditFinding_org_status_idx" ON "AuditFinding"("organizationId","status","severity");

CREATE OR REPLACE FUNCTION reject_audit_accreditation_evidence_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Audit/accreditation evidence is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "AccreditationRequirement_append_only" BEFORE UPDATE OR DELETE ON "AccreditationRequirement" FOR EACH ROW EXECUTE FUNCTION reject_audit_accreditation_evidence_mutation();
CREATE TRIGGER "AuditStatusChange_append_only" BEFORE UPDATE OR DELETE ON "AuditStatusChange" FOR EACH ROW EXECUTE FUNCTION reject_audit_accreditation_evidence_mutation();
CREATE TRIGGER "AuditFindingStatusChange_append_only" BEFORE UPDATE OR DELETE ON "AuditFindingStatusChange" FOR EACH ROW EXECUTE FUNCTION reject_audit_accreditation_evidence_mutation();

CREATE OR REPLACE FUNCTION guard_audit_status_transition() RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status='PLANNED' AND NEW.status IN ('IN_PROGRESS','CANCELLED')) OR
    (OLD.status='IN_PROGRESS' AND NEW.status IN ('COMPLETED','CANCELLED'))
  ) THEN RAISE EXCEPTION 'Invalid audit status transition'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "Audit_status_guard" BEFORE UPDATE OF status ON "Audit" FOR EACH ROW EXECUTE FUNCTION guard_audit_status_transition();

CREATE OR REPLACE FUNCTION guard_audit_finding_status_transition() RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status='OPEN' AND NEW.status='UNDER_REVIEW') OR
    (OLD.status='UNDER_REVIEW' AND NEW.status IN ('OPEN','CLOSED'))
  ) THEN RAISE EXCEPTION 'Invalid audit finding status transition'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "AuditFinding_status_guard" BEFORE UPDATE OF status ON "AuditFinding" FOR EACH ROW EXECUTE FUNCTION guard_audit_finding_status_transition();

INSERT INTO "Permission" ("id","key","description") VALUES
  (gen_random_uuid(),'audit.read','View audits and audit findings'),
  (gen_random_uuid(),'audit.manage','Create and manage audits and audit findings'),
  (gen_random_uuid(),'accreditation.read','View accreditation programs and requirements'),
  (gen_random_uuid(),'accreditation.manage','Create and manage accreditation programs and requirements')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."systemRole"=true AND r."name"='System Administrator' AND p."key" IN ('audit.read','audit.manage','accreditation.read','accreditation.manage')
ON CONFLICT ("roleId","permissionId") DO NOTHING;
