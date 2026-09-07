INSERT INTO "Permission" ("id", "key", "description")
VALUES
  (gen_random_uuid(), 'record.archive', 'Archive an eligible regulated quality record after retention and legal-hold checks')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."systemRole" = true
  AND r."name" = 'System Administrator'
  AND p."key" = 'record.archive'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
