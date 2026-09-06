ALTER TABLE "DocumentReviewTask"
  ADD COLUMN "assignedToUserId" UUID,
  ADD COLUMN "cycleNumber" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "DocumentReviewTask"
  ADD CONSTRAINT "DocumentReviewTask_cycle_positive" CHECK ("cycleNumber" > 0),
  ADD CONSTRAINT "DocumentReviewTask_assignee_fkey"
    FOREIGN KEY ("organizationId", "assignedToUserId")
    REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT;

DROP INDEX "DocumentReviewTask_organizationId_documentVersionId_key";
CREATE UNIQUE INDEX "DocumentReviewTask_org_version_cycle_key"
  ON "DocumentReviewTask"("organizationId", "documentVersionId", "cycleNumber");
CREATE INDEX "DocumentReviewTask_assignee_status_due_idx"
  ON "DocumentReviewTask"("organizationId", "assignedToUserId", "status", "dueAt");

CREATE OR REPLACE FUNCTION protect_document_review_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Document review evidence cannot be deleted';
  END IF;

  IF OLD."status" <> 'PENDING' THEN
    RAISE EXCEPTION 'Completed or cancelled document review evidence is immutable';
  END IF;

  IF OLD."organizationId" <> NEW."organizationId"
     OR OLD."documentId" <> NEW."documentId"
     OR OLD."documentVersionId" <> NEW."documentVersionId"
     OR OLD."dueAt" <> NEW."dueAt"
     OR OLD."cycleNumber" <> NEW."cycleNumber"
     OR OLD."createdAt" <> NEW."createdAt" THEN
    RAISE EXCEPTION 'Document review identity is immutable';
  END IF;

  IF NEW."status" = 'PENDING' THEN
    IF NEW."completedAt" IS DISTINCT FROM OLD."completedAt"
       OR NEW."completedByUserId" IS DISTINCT FROM OLD."completedByUserId"
       OR NEW."outcome" IS DISTINCT FROM OLD."outcome"
       OR NEW."comments" IS DISTINCT FROM OLD."comments" THEN
      RAISE EXCEPTION 'Pending document review evidence can only be reassigned';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."status" NOT IN ('COMPLETED', 'CANCELLED')
     OR NEW."assignedToUserId" IS DISTINCT FROM OLD."assignedToUserId" THEN
    RAISE EXCEPTION 'Invalid document review state transition';
  END IF;

  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION protect_controlled_document_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."status" IN ('EFFECTIVE', 'SUPERSEDED', 'RETIRED') THEN
    RAISE EXCEPTION 'Controlled document history cannot be deleted';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status" IN ('SUPERSEDED', 'RETIRED')
     AND ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*) THEN
    RAISE EXCEPTION 'Historical controlled document versions are immutable';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status" = 'EFFECTIVE' THEN
    IF NEW."status" = 'EFFECTIVE' THEN
      IF NEW."lockVersion" <> OLD."lockVersion" + 1
         OR NEW."organizationId" <> OLD."organizationId"
         OR NEW."documentId" <> OLD."documentId"
         OR NEW."versionNumber" <> OLD."versionNumber"
         OR NEW."revisionLabel" <> OLD."revisionLabel"
         OR NEW."authoredByUserId" <> OLD."authoredByUserId"
         OR NEW."contentHash" <> OLD."contentHash"
         OR NEW."contentText" IS DISTINCT FROM OLD."contentText"
         OR NEW."changeSummary" <> OLD."changeSummary"
         OR NEW."effectiveAt" IS DISTINCT FROM OLD."effectiveAt"
         OR NEW."supersededAt" IS DISTINCT FROM OLD."supersededAt"
         OR NEW."fileId" IS DISTINCT FROM OLD."fileId"
         OR NEW."createdAt" <> OLD."createdAt"
         OR NEW."reviewDueAt" IS NOT DISTINCT FROM OLD."reviewDueAt" THEN
        RAISE EXCEPTION 'Effective controlled document versions only permit controlled review scheduling metadata changes';
      END IF;
    ELSIF NEW."status" = 'SUPERSEDED' THEN
      IF NEW."supersededAt" IS NULL
         OR NEW."lockVersion" <> OLD."lockVersion" + 1
         OR NEW."organizationId" <> OLD."organizationId"
         OR NEW."documentId" <> OLD."documentId"
         OR NEW."versionNumber" <> OLD."versionNumber"
         OR NEW."revisionLabel" <> OLD."revisionLabel"
         OR NEW."authoredByUserId" <> OLD."authoredByUserId"
         OR NEW."contentHash" <> OLD."contentHash"
         OR NEW."contentText" IS DISTINCT FROM OLD."contentText"
         OR NEW."changeSummary" <> OLD."changeSummary"
         OR NEW."effectiveAt" IS DISTINCT FROM OLD."effectiveAt"
         OR NEW."reviewDueAt" IS DISTINCT FROM OLD."reviewDueAt"
         OR NEW."fileId" IS DISTINCT FROM OLD."fileId"
         OR NEW."createdAt" <> OLD."createdAt" THEN
        RAISE EXCEPTION 'Effective controlled document versions are immutable except for controlled supersession';
      END IF;
    ELSIF NEW."status" = 'RETIRED' THEN
      IF NEW."lockVersion" <> OLD."lockVersion" + 1
         OR NEW."organizationId" <> OLD."organizationId"
         OR NEW."documentId" <> OLD."documentId"
         OR NEW."versionNumber" <> OLD."versionNumber"
         OR NEW."revisionLabel" <> OLD."revisionLabel"
         OR NEW."authoredByUserId" <> OLD."authoredByUserId"
         OR NEW."contentHash" <> OLD."contentHash"
         OR NEW."contentText" IS DISTINCT FROM OLD."contentText"
         OR NEW."changeSummary" <> OLD."changeSummary"
         OR NEW."effectiveAt" IS DISTINCT FROM OLD."effectiveAt"
         OR NEW."reviewDueAt" IS DISTINCT FROM OLD."reviewDueAt"
         OR NEW."supersededAt" IS DISTINCT FROM OLD."supersededAt"
         OR NEW."fileId" IS DISTINCT FROM OLD."fileId"
         OR NEW."createdAt" <> OLD."createdAt" THEN
        RAISE EXCEPTION 'Effective controlled document versions are immutable except for controlled retirement';
      END IF;
    ELSE
      RAISE EXCEPTION 'Effective controlled document versions require a controlled lifecycle transition';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END; $$;
