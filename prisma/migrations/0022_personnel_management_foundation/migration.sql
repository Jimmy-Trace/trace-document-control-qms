CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TERMINATED');

CREATE TABLE "Employee" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "userId" uuid,
  "employeeNumber" text NOT NULL,
  "firstName" text NOT NULL,
  "lastName" text NOT NULL,
  "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
  "hireDate" date,
  "terminationDate" date,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Employee_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Employee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Employee_user_fkey" FOREIGN KEY ("organizationId", "userId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Employee_organizationId_id_key" UNIQUE ("organizationId", "id"),
  CONSTRAINT "Employee_organizationId_employeeNumber_key" UNIQUE ("organizationId", "employeeNumber"),
  CONSTRAINT "Employee_organizationId_userId_key" UNIQUE ("organizationId", "userId"),
  CONSTRAINT "Employee_termination_after_hire_check" CHECK ("terminationDate" IS NULL OR "hireDate" IS NULL OR "terminationDate" >= "hireDate")
);

CREATE TABLE "JobDescription" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "code" text NOT NULL,
  "title" text NOT NULL,
  "summary" text,
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobDescription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JobDescription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "JobDescription_organizationId_id_key" UNIQUE ("organizationId", "id"),
  CONSTRAINT "JobDescription_organizationId_code_key" UNIQUE ("organizationId", "code")
);

CREATE TABLE "EmployeeJobAssignment" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "employeeId" uuid NOT NULL,
  "jobDescriptionId" uuid NOT NULL,
  "siteId" uuid,
  "departmentId" uuid,
  "isPrimary" boolean NOT NULL DEFAULT false,
  "assignedAt" date NOT NULL,
  "endedAt" date,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeJobAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmployeeJobAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeJobAssignment_employee_fkey" FOREIGN KEY ("organizationId", "employeeId") REFERENCES "Employee"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeJobAssignment_job_fkey" FOREIGN KEY ("organizationId", "jobDescriptionId") REFERENCES "JobDescription"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeJobAssignment_site_fkey" FOREIGN KEY ("organizationId", "siteId") REFERENCES "Site"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeJobAssignment_department_fkey" FOREIGN KEY ("organizationId", "departmentId") REFERENCES "Department"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeJobAssignment_creator_fkey" FOREIGN KEY ("organizationId", "createdByUserId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeJobAssignment_organizationId_id_key" UNIQUE ("organizationId", "id"),
  CONSTRAINT "EmployeeJobAssignment_dates_check" CHECK ("endedAt" IS NULL OR "endedAt" >= "assignedAt")
);

CREATE INDEX "Employee_organizationId_status_idx" ON "Employee"("organizationId", "status");
CREATE INDEX "EmployeeJobAssignment_organizationId_employeeId_assignedAt_idx" ON "EmployeeJobAssignment"("organizationId", "employeeId", "assignedAt");
CREATE INDEX "EmployeeJobAssignment_organizationId_jobDescriptionId_idx" ON "EmployeeJobAssignment"("organizationId", "jobDescriptionId");
CREATE UNIQUE INDEX "EmployeeJobAssignment_one_active_primary_per_employee_idx"
  ON "EmployeeJobAssignment"("organizationId", "employeeId")
  WHERE "isPrimary" = true AND "endedAt" IS NULL;

INSERT INTO "Permission" ("id", "key", "description")
VALUES
  (gen_random_uuid(), 'personnel.read', 'View governed personnel records'),
  (gen_random_uuid(), 'personnel.manage', 'Create and manage governed personnel records and job assignments')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."systemRole" = true
  AND r."name" = 'System Administrator'
  AND p."key" IN ('personnel.read', 'personnel.manage')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
