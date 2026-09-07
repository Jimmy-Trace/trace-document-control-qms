CREATE TYPE "CompetencyAssessmentOutcome" AS ENUM ('QUALIFIED', 'NOT_QUALIFIED', 'CONDITIONAL');
CREATE TYPE "CompetencyElementOutcome" AS ENUM ('PASS', 'FAIL', 'NOT_APPLICABLE');

CREATE TABLE "CompetencyProgram" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "code" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "active" boolean NOT NULL DEFAULT true,
  "validityDays" integer,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompetencyProgram_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompetencyProgram_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CompetencyProgram_organizationId_id_key" UNIQUE ("organizationId", "id"),
  CONSTRAINT "CompetencyProgram_organizationId_code_key" UNIQUE ("organizationId", "code"),
  CONSTRAINT "CompetencyProgram_code_not_blank_check" CHECK (length(btrim("code")) > 0),
  CONSTRAINT "CompetencyProgram_title_not_blank_check" CHECK (length(btrim("title")) > 0),
  CONSTRAINT "CompetencyProgram_validityDays_check" CHECK ("validityDays" IS NULL OR "validityDays" > 0)
);

CREATE TABLE "CompetencyElement" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "programId" uuid NOT NULL,
  "code" text NOT NULL,
  "title" text NOT NULL,
  "method" text,
  "required" boolean NOT NULL DEFAULT true,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompetencyElement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompetencyElement_program_fkey" FOREIGN KEY ("organizationId", "programId") REFERENCES "CompetencyProgram"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CompetencyElement_organizationId_id_key" UNIQUE ("organizationId", "id"),
  CONSTRAINT "CompetencyElement_programId_code_key" UNIQUE ("organizationId", "programId", "code"),
  CONSTRAINT "CompetencyElement_code_not_blank_check" CHECK (length(btrim("code")) > 0),
  CONSTRAINT "CompetencyElement_title_not_blank_check" CHECK (length(btrim("title")) > 0)
);

CREATE TABLE "CompetencyAssessment" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "employeeId" uuid NOT NULL,
  "programId" uuid NOT NULL,
  "assessedAt" timestamptz(3) NOT NULL,
  "outcome" "CompetencyAssessmentOutcome" NOT NULL,
  "expiresAt" date,
  "assessorUserId" uuid NOT NULL,
  "fileId" uuid,
  "notes" text,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompetencyAssessment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompetencyAssessment_employee_fkey" FOREIGN KEY ("organizationId", "employeeId") REFERENCES "Employee"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CompetencyAssessment_program_fkey" FOREIGN KEY ("organizationId", "programId") REFERENCES "CompetencyProgram"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CompetencyAssessment_assessor_fkey" FOREIGN KEY ("organizationId", "assessorUserId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CompetencyAssessment_file_fkey" FOREIGN KEY ("organizationId", "fileId") REFERENCES "FileObject"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CompetencyAssessment_organizationId_id_key" UNIQUE ("organizationId", "id")
);

CREATE TABLE "CompetencyAssessmentElement" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "assessmentId" uuid NOT NULL,
  "elementId" uuid NOT NULL,
  "outcome" "CompetencyElementOutcome" NOT NULL,
  "notes" text,
  CONSTRAINT "CompetencyAssessmentElement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompetencyAssessmentElement_assessment_fkey" FOREIGN KEY ("organizationId", "assessmentId") REFERENCES "CompetencyAssessment"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CompetencyAssessmentElement_element_fkey" FOREIGN KEY ("organizationId", "elementId") REFERENCES "CompetencyElement"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CompetencyAssessmentElement_assessment_element_key" UNIQUE ("organizationId", "assessmentId", "elementId")
);

CREATE INDEX "CompetencyProgram_organizationId_active_idx" ON "CompetencyProgram"("organizationId", "active");
CREATE INDEX "CompetencyElement_program_sort_idx" ON "CompetencyElement"("organizationId", "programId", "sortOrder");
CREATE INDEX "CompetencyAssessment_employee_program_date_idx" ON "CompetencyAssessment"("organizationId", "employeeId", "programId", "assessedAt" DESC);
CREATE INDEX "CompetencyAssessment_expiresAt_idx" ON "CompetencyAssessment"("organizationId", "expiresAt") WHERE "expiresAt" IS NOT NULL;
