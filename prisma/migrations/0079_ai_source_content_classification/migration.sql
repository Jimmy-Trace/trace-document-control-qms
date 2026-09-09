CREATE TYPE "AiSourceContentClass" AS ENUM (
  'NON_SENSITIVE',
  'CONTROLLED_QMS',
  'PERSONNEL_CONFIDENTIAL',
  'SECURITY_SECRET'
);

ALTER TABLE "AiTenantPolicy"
  ADD COLUMN "allowedSourceContentClasses" "AiSourceContentClass"[] NOT NULL DEFAULT ARRAY[]::"AiSourceContentClass"[];

ALTER TABLE "AiTenantPolicyEvent"
  ADD COLUMN "allowedSourceContentClasses" "AiSourceContentClass"[] NOT NULL DEFAULT ARRAY[]::"AiSourceContentClass"[];

COMMENT ON COLUMN "AiTenantPolicy"."allowedSourceContentClasses" IS
  'Explicit tenant allow-list for source-content classes permitted to leave the QMS for approved AI assistance. Empty is default-deny.';
