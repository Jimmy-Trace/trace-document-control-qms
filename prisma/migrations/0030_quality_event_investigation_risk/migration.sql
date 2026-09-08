CREATE TYPE "RootCauseMethod" AS ENUM ('FIVE_WHYS','FISHBONE','FAULT_TREE','OTHER');

CREATE TABLE "QualityEventInvestigation" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "eventId" uuid NOT NULL,
  "sequence" integer NOT NULL,
  "findings" text NOT NULL,
  "affectedScope" text NOT NULL,
  "evidenceSummary" text,
  "rootCauseMethod" "RootCauseMethod" NOT NULL,
  "rootCause" text NOT NULL,
  "riskLikelihood" smallint NOT NULL,
  "riskImpact" smallint NOT NULL,
  "riskScore" smallint NOT NULL,
  "investigatorUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QualityEventInvestigation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QualityEventInvestigation_event_fkey" FOREIGN KEY ("organizationId", "eventId") REFERENCES "QualityEvent"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityEventInvestigation_investigator_fkey" FOREIGN KEY ("organizationId", "investigatorUserId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QualityEventInvestigation_org_event_sequence_key" UNIQUE ("organizationId", "eventId", "sequence"),
  CONSTRAINT "QualityEventInvestigation_findings_not_blank" CHECK (length(btrim("findings")) > 0),
  CONSTRAINT "QualityEventInvestigation_scope_not_blank" CHECK (length(btrim("affectedScope")) > 0),
  CONSTRAINT "QualityEventInvestigation_root_cause_not_blank" CHECK (length(btrim("rootCause")) > 0),
  CONSTRAINT "QualityEventInvestigation_likelihood_range" CHECK ("riskLikelihood" BETWEEN 1 AND 5),
  CONSTRAINT "QualityEventInvestigation_impact_range" CHECK ("riskImpact" BETWEEN 1 AND 5),
  CONSTRAINT "QualityEventInvestigation_score_consistent" CHECK ("riskScore" = "riskLikelihood" * "riskImpact")
);

CREATE INDEX "QualityEventInvestigation_org_event_created_idx" ON "QualityEventInvestigation"("organizationId", "eventId", "createdAt" DESC);
