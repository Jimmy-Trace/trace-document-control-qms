CREATE TABLE "DocumentFolder" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "parentFolderId" uuid,
  "name" text NOT NULL,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentFolder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentFolder_org_id_key" UNIQUE ("organizationId", "id"),
  CONSTRAINT "DocumentFolder_org_fk" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "DocumentFolder_parent_fk" FOREIGN KEY ("organizationId", "parentFolderId") REFERENCES "DocumentFolder"("organizationId", "id") ON DELETE RESTRICT,
  CONSTRAINT "DocumentFolder_creator_fk" FOREIGN KEY ("organizationId", "createdByUserId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT,
  CONSTRAINT "DocumentFolder_name_nonblank" CHECK (length(btrim("name")) BETWEEN 1 AND 120),
  CONSTRAINT "DocumentFolder_not_self_parent" CHECK ("parentFolderId" IS NULL OR "parentFolderId" <> "id")
);

CREATE UNIQUE INDEX "DocumentFolder_sibling_name_key"
  ON "DocumentFolder" ("organizationId", COALESCE("parentFolderId", '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim("name")));
CREATE INDEX "DocumentFolder_parent_idx" ON "DocumentFolder" ("organizationId", "parentFolderId", "name");

CREATE TABLE "DocumentFolderPlacement" (
  "organizationId" uuid NOT NULL,
  "documentId" uuid NOT NULL,
  "folderId" uuid NOT NULL,
  "placedByUserId" uuid NOT NULL,
  "placedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentFolderPlacement_pkey" PRIMARY KEY ("organizationId", "documentId"),
  CONSTRAINT "DocumentFolderPlacement_document_fk" FOREIGN KEY ("organizationId", "documentId") REFERENCES "Document"("organizationId", "id") ON DELETE CASCADE,
  CONSTRAINT "DocumentFolderPlacement_folder_fk" FOREIGN KEY ("organizationId", "folderId") REFERENCES "DocumentFolder"("organizationId", "id") ON DELETE RESTRICT,
  CONSTRAINT "DocumentFolderPlacement_actor_fk" FOREIGN KEY ("organizationId", "placedByUserId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT
);

CREATE INDEX "DocumentFolderPlacement_folder_idx" ON "DocumentFolderPlacement" ("organizationId", "folderId", "documentId");