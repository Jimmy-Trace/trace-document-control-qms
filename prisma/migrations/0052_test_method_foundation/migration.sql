CREATE TYPE "LaboratoryTestStatus" AS ENUM ('DRAFT','ACTIVE','RETIRED');
CREATE TYPE "LaboratoryMethodStatus" AS ENUM ('DRAFT','ACTIVE','RETIRED');

CREATE TABLE "LaboratoryTest" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "testCode" text NOT NULL,
  "name" text NOT NULL,
  "discipline" text,
  "specimenType" text,
  "status" "LaboratoryTestStatus" NOT NULL DEFAULT 'DRAFT',
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LaboratoryTest_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "LaboratoryTest_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "LaboratoryTest_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "LaboratoryTest_org_code_key" UNIQUE ("organizationId","testCode"),
  CONSTRAINT "LaboratoryTest_code_check" CHECK (length(btrim("testCode"))>0),
  CONSTRAINT "LaboratoryTest_name_check" CHECK (length(btrim("name"))>0)
);

CREATE TABLE "LaboratoryMethod" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "laboratoryTestId" uuid NOT NULL,
  "methodCode" text NOT NULL,
  "name" text NOT NULL,
  "platform" text,
  "status" "LaboratoryMethodStatus" NOT NULL DEFAULT 'DRAFT',
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LaboratoryMethod_test_fkey" FOREIGN KEY ("organizationId","laboratoryTestId") REFERENCES "LaboratoryTest"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "LaboratoryMethod_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "LaboratoryMethod_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "LaboratoryMethod_org_code_key" UNIQUE ("organizationId","methodCode"),
  CONSTRAINT "LaboratoryMethod_code_check" CHECK (length(btrim("methodCode"))>0),
  CONSTRAINT "LaboratoryMethod_name_check" CHECK (length(btrim("name"))>0)
);

CREATE TABLE "LaboratoryMethodVersion" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "laboratoryMethodId" uuid NOT NULL,
  "versionLabel" text NOT NULL,
  "changeSummary" text NOT NULL,
  "procedureFileId" uuid,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LaboratoryMethodVersion_method_fkey" FOREIGN KEY ("organizationId","laboratoryMethodId") REFERENCES "LaboratoryMethod"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "LaboratoryMethodVersion_file_fkey" FOREIGN KEY ("organizationId","procedureFileId") REFERENCES "FileObject"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "LaboratoryMethodVersion_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "LaboratoryMethodVersion_org_method_version_key" UNIQUE ("organizationId","laboratoryMethodId","versionLabel"),
  CONSTRAINT "LaboratoryMethodVersion_version_check" CHECK (length(btrim("versionLabel"))>0),
  CONSTRAINT "LaboratoryMethodVersion_summary_check" CHECK (length(btrim("changeSummary"))>0)
);

CREATE TABLE "LaboratoryTestStatusChange" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "laboratoryTestId" uuid NOT NULL,
  "fromStatus" "LaboratoryTestStatus" NOT NULL,
  "toStatus" "LaboratoryTestStatus" NOT NULL,
  "reason" text NOT NULL,
  "actorUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LaboratoryTestStatusChange_test_fkey" FOREIGN KEY ("organizationId","laboratoryTestId") REFERENCES "LaboratoryTest"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "LaboratoryTestStatusChange_actor_fkey" FOREIGN KEY ("organizationId","actorUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "LaboratoryTestStatusChange_reason_check" CHECK (length(btrim("reason"))>0)
);

CREATE TABLE "LaboratoryMethodStatusChange" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "laboratoryMethodId" uuid NOT NULL,
  "fromStatus" "LaboratoryMethodStatus" NOT NULL,
  "toStatus" "LaboratoryMethodStatus" NOT NULL,
  "reason" text NOT NULL,
  "actorUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LaboratoryMethodStatusChange_method_fkey" FOREIGN KEY ("organizationId","laboratoryMethodId") REFERENCES "LaboratoryMethod"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "LaboratoryMethodStatusChange_actor_fkey" FOREIGN KEY ("organizationId","actorUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "LaboratoryMethodStatusChange_reason_check" CHECK (length(btrim("reason"))>0)
);

CREATE INDEX "LaboratoryTest_org_status_idx" ON "LaboratoryTest"("organizationId","status");
CREATE INDEX "LaboratoryMethod_org_test_status_idx" ON "LaboratoryMethod"("organizationId","laboratoryTestId","status");
CREATE INDEX "LaboratoryMethodVersion_org_method_idx" ON "LaboratoryMethodVersion"("organizationId","laboratoryMethodId","createdAt" DESC);
CREATE INDEX "LaboratoryTestStatusChange_org_test_idx" ON "LaboratoryTestStatusChange"("organizationId","laboratoryTestId","createdAt" DESC);
CREATE INDEX "LaboratoryMethodStatusChange_org_method_idx" ON "LaboratoryMethodStatusChange"("organizationId","laboratoryMethodId","createdAt" DESC);

CREATE OR REPLACE FUNCTION reject_laboratory_test_method_evidence_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Laboratory test/method evidence is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "LaboratoryMethodVersion_append_only" BEFORE UPDATE OR DELETE ON "LaboratoryMethodVersion" FOR EACH ROW EXECUTE FUNCTION reject_laboratory_test_method_evidence_mutation();
CREATE TRIGGER "LaboratoryTestStatusChange_append_only" BEFORE UPDATE OR DELETE ON "LaboratoryTestStatusChange" FOR EACH ROW EXECUTE FUNCTION reject_laboratory_test_method_evidence_mutation();
CREATE TRIGGER "LaboratoryMethodStatusChange_append_only" BEFORE UPDATE OR DELETE ON "LaboratoryMethodStatusChange" FOR EACH ROW EXECUTE FUNCTION reject_laboratory_test_method_evidence_mutation();

CREATE OR REPLACE FUNCTION guard_lab_test_status() RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status IN ('DRAFT','ACTIVE') AND NEW.status='RETIRED') THEN
    RAISE EXCEPTION 'Laboratory test activation is validation-gated; only retirement is currently permitted';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "LaboratoryTest_status_guard" BEFORE UPDATE OF status ON "LaboratoryTest" FOR EACH ROW EXECUTE FUNCTION guard_lab_test_status();

CREATE OR REPLACE FUNCTION guard_lab_method_status() RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status IN ('DRAFT','ACTIVE') AND NEW.status='RETIRED') THEN
    RAISE EXCEPTION 'Laboratory method activation is validation-gated; only retirement is currently permitted';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "LaboratoryMethod_status_guard" BEFORE UPDATE OF status ON "LaboratoryMethod" FOR EACH ROW EXECUTE FUNCTION guard_lab_method_status();

INSERT INTO "Permission" ("id","key","description") VALUES
  (gen_random_uuid(),'lab_test.read','View governed laboratory tests, methods, and method versions'),
  (gen_random_uuid(),'lab_test.manage','Create and manage governed laboratory tests, methods, and method versions')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."systemRole"=true AND r."name"='System Administrator' AND p."key" IN ('lab_test.read','lab_test.manage')
ON CONFLICT ("roleId","permissionId") DO NOTHING;
