CREATE TYPE "QualityCapaActionType" AS ENUM ('CORRECTIVE','PREVENTIVE');
CREATE TYPE "QualityCapaActionStatus" AS ENUM ('OPEN','COMPLETED');
CREATE TYPE "QualityEffectivenessResult" AS ENUM ('PASS','FAIL');

CREATE TABLE "QualityCapaAction" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "eventId" uuid NOT NULL,
  "actionType" "QualityCapaActionType" NOT NULL,
  "description" text NOT NULL,
  "ownerUserId" uuid NOT NULL,
  "dueAt" date NOT NULL,
  "status" "QualityCapaActionStatus" NOT NULL DEFAULT 'OPEN',
  "completedAt" timestamptz(3),
  "completionEvidence" text,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QualityCapaAction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QualityCapaAction_event_fkey" FOREIGN KEY ("organizationId","eventId") REFERENCES "QualityEvent"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityCapaAction_owner_fkey" FOREIGN KEY ("organizationId","ownerUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityCapaAction_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityCapaAction_description_not_blank_check" CHECK (length(btrim("description")) > 0),
  CONSTRAINT "QualityCapaAction_completion_consistency_check" CHECK (("status"='OPEN' AND "completedAt" IS NULL AND "completionEvidence" IS NULL) OR ("status"='COMPLETED' AND "completedAt" IS NOT NULL AND length(btrim("completionEvidence")) > 0))
);
CREATE INDEX "QualityCapaAction_org_event_status_idx" ON "QualityCapaAction"("organizationId","eventId","status","dueAt");

CREATE TABLE "QualityEffectivenessCheck" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "eventId" uuid NOT NULL,
  "capaActionId" uuid NOT NULL,
  "result" "QualityEffectivenessResult" NOT NULL,
  "evidence" text NOT NULL,
  "checkedByUserId" uuid NOT NULL,
  "checkedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QualityEffectivenessCheck_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QualityEffectivenessCheck_action_fkey" FOREIGN KEY ("organizationId","capaActionId") REFERENCES "QualityCapaAction"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityEffectivenessCheck_event_fkey" FOREIGN KEY ("organizationId","eventId") REFERENCES "QualityEvent"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityEffectivenessCheck_checker_fkey" FOREIGN KEY ("organizationId","checkedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityEffectivenessCheck_evidence_not_blank_check" CHECK (length(btrim("evidence")) > 0)
);
CREATE INDEX "QualityEffectivenessCheck_org_event_checked_idx" ON "QualityEffectivenessCheck"("organizationId","eventId","checkedAt" DESC);
