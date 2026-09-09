CREATE TYPE "IntegrationClientStatus" AS ENUM ('ACTIVE','REVOKED');

CREATE TABLE "IntegrationClient" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "name" text NOT NULL,
  "status" "IntegrationClientStatus" NOT NULL DEFAULT 'ACTIVE',
  "secretHash" text NOT NULL,
  "scopes" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedByUserId" uuid,
  "revokedAt" timestamptz(3),
  "lastUsedAt" timestamptz(3),
  CONSTRAINT "IntegrationClient_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "IntegrationClient_creator_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "IntegrationClient_revoker_fkey" FOREIGN KEY ("organizationId","revokedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "IntegrationClient_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "IntegrationClient_org_name_key" UNIQUE ("organizationId","name"),
  CONSTRAINT "IntegrationClient_name_check" CHECK (length(btrim("name"))>0),
  CONSTRAINT "IntegrationClient_hash_check" CHECK ("secretHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "IntegrationClient_revoke_check" CHECK ((status='REVOKED' AND "revokedAt" IS NOT NULL AND "revokedByUserId" IS NOT NULL) OR (status='ACTIVE' AND "revokedAt" IS NULL AND "revokedByUserId" IS NULL))
);

CREATE INDEX "IntegrationClient_org_status_idx" ON "IntegrationClient"("organizationId",status,name);

INSERT INTO "Permission" ("id","key","description") VALUES
  (gen_random_uuid(),'integration.manage','Create and revoke tenant-scoped external integration clients')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."systemRole"=true AND r."name"='System Administrator' AND p."key"='integration.manage'
ON CONFLICT ("roleId","permissionId") DO NOTHING;
