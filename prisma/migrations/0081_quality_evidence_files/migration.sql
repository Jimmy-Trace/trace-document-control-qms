ALTER TABLE "QualityEventInvestigation"
  ADD COLUMN "evidenceFileId" uuid;

ALTER TABLE "QualityCapaAction"
  ADD COLUMN "completionEvidenceFileId" uuid;

ALTER TABLE "QualityEffectivenessCheck"
  ADD COLUMN "evidenceFileId" uuid;

ALTER TABLE "QualityEventInvestigation"
  ADD CONSTRAINT "QualityEventInvestigation_evidence_file_fkey"
  FOREIGN KEY ("organizationId","evidenceFileId") REFERENCES "FileObject"("organizationId","id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "QualityCapaAction"
  ADD CONSTRAINT "QualityCapaAction_completion_evidence_file_fkey"
  FOREIGN KEY ("organizationId","completionEvidenceFileId") REFERENCES "FileObject"("organizationId","id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "QualityEffectivenessCheck"
  ADD CONSTRAINT "QualityEffectivenessCheck_evidence_file_fkey"
  FOREIGN KEY ("organizationId","evidenceFileId") REFERENCES "FileObject"("organizationId","id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
