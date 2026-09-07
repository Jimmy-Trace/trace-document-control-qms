INSERT INTO "Permission" ("id", "key", "description")
VALUES
  (gen_random_uuid(), 'document.revise', 'Create a new revision from an existing controlled document version'),
  (gen_random_uuid(), 'document.retire', 'Retire a controlled document version'),
  (gen_random_uuid(), 'document.export', 'Export an exact controlled document version')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."systemRole" = true
  AND r."name" = 'System Administrator'
  AND p."key" IN ('document.revise', 'document.retire', 'document.export')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
