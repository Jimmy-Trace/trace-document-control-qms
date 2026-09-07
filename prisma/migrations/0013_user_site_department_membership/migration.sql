CREATE TABLE "UserSiteMembership" (
  "organizationId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "siteId" UUID NOT NULL,
  "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedByUserId" UUID,
  CONSTRAINT "UserSiteMembership_pkey" PRIMARY KEY ("organizationId", "userId", "siteId"),
  CONSTRAINT "UserSiteMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "UserSiteMembership_user_fkey" FOREIGN KEY ("organizationId", "userId") REFERENCES "User"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserSiteMembership_site_fkey" FOREIGN KEY ("organizationId", "siteId") REFERENCES "Site"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserSiteMembership_assigner_fkey" FOREIGN KEY ("organizationId", "assignedByUserId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "UserSiteMembership_org_site_idx" ON "UserSiteMembership"("organizationId", "siteId");
CREATE INDEX "UserSiteMembership_org_user_idx" ON "UserSiteMembership"("organizationId", "userId");

CREATE TABLE "UserDepartmentMembership" (
  "organizationId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "departmentId" UUID NOT NULL,
  "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedByUserId" UUID,
  CONSTRAINT "UserDepartmentMembership_pkey" PRIMARY KEY ("organizationId", "userId", "departmentId"),
  CONSTRAINT "UserDepartmentMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "UserDepartmentMembership_user_fkey" FOREIGN KEY ("organizationId", "userId") REFERENCES "User"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserDepartmentMembership_department_fkey" FOREIGN KEY ("organizationId", "departmentId") REFERENCES "Department"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserDepartmentMembership_assigner_fkey" FOREIGN KEY ("organizationId", "assignedByUserId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "UserDepartmentMembership_org_department_idx" ON "UserDepartmentMembership"("organizationId", "departmentId");
CREATE INDEX "UserDepartmentMembership_org_user_idx" ON "UserDepartmentMembership"("organizationId", "userId");
