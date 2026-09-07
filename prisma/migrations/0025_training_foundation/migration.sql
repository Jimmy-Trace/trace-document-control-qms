CREATE TYPE "TrainingAssignmentStatus" AS ENUM ('ASSIGNED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "TrainingCourse" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "code" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainingCourse_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TrainingCourse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TrainingCourse_organizationId_id_key" UNIQUE ("organizationId", "id"),
  CONSTRAINT "TrainingCourse_organizationId_code_key" UNIQUE ("organizationId", "code"),
  CONSTRAINT "TrainingCourse_code_not_blank_check" CHECK (length(btrim("code")) > 0),
  CONSTRAINT "TrainingCourse_title_not_blank_check" CHECK (length(btrim("title")) > 0)
);

CREATE TABLE "TrainingAssignment" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "employeeId" uuid NOT NULL,
  "courseId" uuid NOT NULL,
  "assignedAt" date NOT NULL,
  "dueAt" date,
  "status" "TrainingAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainingAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TrainingAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TrainingAssignment_employee_fkey" FOREIGN KEY ("organizationId", "employeeId") REFERENCES "Employee"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TrainingAssignment_course_fkey" FOREIGN KEY ("organizationId", "courseId") REFERENCES "TrainingCourse"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TrainingAssignment_creator_fkey" FOREIGN KEY ("organizationId", "createdByUserId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TrainingAssignment_organizationId_id_key" UNIQUE ("organizationId", "id"),
  CONSTRAINT "TrainingAssignment_dates_check" CHECK ("dueAt" IS NULL OR "dueAt" >= "assignedAt")
);

CREATE TABLE "TrainingRecord" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "assignmentId" uuid NOT NULL,
  "employeeId" uuid NOT NULL,
  "courseId" uuid NOT NULL,
  "completedAt" timestamptz(3) NOT NULL,
  "result" text,
  "fileId" uuid,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainingRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TrainingRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TrainingRecord_assignment_fkey" FOREIGN KEY ("organizationId", "assignmentId") REFERENCES "TrainingAssignment"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TrainingRecord_employee_fkey" FOREIGN KEY ("organizationId", "employeeId") REFERENCES "Employee"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TrainingRecord_course_fkey" FOREIGN KEY ("organizationId", "courseId") REFERENCES "TrainingCourse"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TrainingRecord_file_fkey" FOREIGN KEY ("organizationId", "fileId") REFERENCES "FileObject"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TrainingRecord_creator_fkey" FOREIGN KEY ("organizationId", "createdByUserId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TrainingRecord_organizationId_id_key" UNIQUE ("organizationId", "id"),
  CONSTRAINT "TrainingRecord_organizationId_assignmentId_key" UNIQUE ("organizationId", "assignmentId")
);

CREATE INDEX "TrainingCourse_organizationId_active_idx" ON "TrainingCourse"("organizationId", "active");
CREATE INDEX "TrainingAssignment_organizationId_employeeId_status_idx" ON "TrainingAssignment"("organizationId", "employeeId", "status");
CREATE INDEX "TrainingAssignment_organizationId_dueAt_idx" ON "TrainingAssignment"("organizationId", "dueAt") WHERE "dueAt" IS NOT NULL;
CREATE INDEX "TrainingRecord_organizationId_employeeId_completedAt_idx" ON "TrainingRecord"("organizationId", "employeeId", "completedAt");

INSERT INTO "Permission" ("id", "key", "description")
VALUES
  (gen_random_uuid(), 'training.read', 'View governed training assignments and completion records'),
  (gen_random_uuid(), 'training.manage', 'Create and manage governed training courses, assignments, and completions')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."systemRole" = true
  AND r."name" = 'System Administrator'
  AND p."key" IN ('training.read', 'training.manage')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
