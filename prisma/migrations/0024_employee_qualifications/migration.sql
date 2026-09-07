CREATE TABLE "EmployeeQualification" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "employeeId" uuid NOT NULL,
  "qualificationType" text NOT NULL,
  "qualificationScope" text,
  "qualifiedAt" date NOT NULL,
  "expiresAt" date,
  "fileId" uuid,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeQualification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmployeeQualification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeQualification_employee_fkey" FOREIGN KEY ("organizationId", "employeeId") REFERENCES "Employee"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeQualification_file_fkey" FOREIGN KEY ("organizationId", "fileId") REFERENCES "FileObject"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeQualification_creator_fkey" FOREIGN KEY ("organizationId", "createdByUserId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeQualification_organizationId_id_key" UNIQUE ("organizationId", "id"),
  CONSTRAINT "EmployeeQualification_dates_check" CHECK ("expiresAt" IS NULL OR "expiresAt" >= "qualifiedAt"),
  CONSTRAINT "EmployeeQualification_type_not_blank_check" CHECK (length(btrim("qualificationType")) > 0)
);

CREATE INDEX "EmployeeQualification_organizationId_employeeId_idx"
  ON "EmployeeQualification"("organizationId", "employeeId", "qualifiedAt");

CREATE INDEX "EmployeeQualification_organizationId_expiresAt_idx"
  ON "EmployeeQualification"("organizationId", "expiresAt")
  WHERE "expiresAt" IS NOT NULL;
