ALTER TABLE "UserRole"
  ADD COLUMN "scopeType" TEXT NOT NULL DEFAULT 'ORGANIZATION',
  ADD COLUMN "scopeId" UUID;

ALTER TABLE "UserRole"
  ADD CONSTRAINT "UserRole_scope_check" CHECK (
    ("scopeType" = 'ORGANIZATION' AND "scopeId" IS NULL) OR
    ("scopeType" IN ('SITE','DEPARTMENT') AND "scopeId" IS NOT NULL)
  );

CREATE INDEX "UserRole_organizationId_scopeType_scopeId_idx"
  ON "UserRole"("organizationId","scopeType","scopeId");
