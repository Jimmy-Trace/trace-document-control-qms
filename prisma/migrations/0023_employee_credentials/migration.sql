CREATE TABLE "EmployeeCredential" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "employeeId" uuid NOT NULL,
  "credentialType" text NOT NULL,
  "credentialNumber" text,
  "issuingAuthority" text,
  "issuedAt" date,
  "expiresAt" date,
  "fileId" uuid,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeCredential_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmployeeCredential_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeCredential_employee_fkey" FOREIGN KEY ("organizationId", "employeeId") REFERENCES "Employee"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeCredential_file_fkey" FOREIGN KEY ("organizationId", "fileId") REFERENCES "FileObject"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeCredential_creator_fkey" FOREIGN KEY ("organizationId", "createdByUserId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeCredential_organizationId_id_key" UNIQUE ("organizationId", "id"),
  CONSTRAINT "EmployeeCredential_dates_check" CHECK ("expiresAt" IS NULL OR "issuedAt" IS NULL OR "expiresAt" >= "issuedAt"),
  CONSTRAINT "EmployeeCredential_type_not_blank_check" CHECK (length(btrim("credentialType")) > 0)
);

CREATE INDEX "EmployeeCredential_organizationId_employeeId_idx"
  ON "EmployeeCredential"("organizationId", "employeeId", "createdAt");

CREATE INDEX "EmployeeCredential_organizationId_expiresAt_idx"
  ON "EmployeeCredential"("organizationId", "expiresAt")
  WHERE "expiresAt" IS NOT NULL;
