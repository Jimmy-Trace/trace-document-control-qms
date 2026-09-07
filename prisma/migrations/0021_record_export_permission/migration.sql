INSERT INTO "Permission" ("id", "key", "description")
VALUES
  (gen_random_uuid(), 'record.export', 'Export the exact governed file bound to a regulated quality record with integrity and audit evidence')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."systemRole" = true
  AND r."name" = 'System Administrator'
  AND p."key" = 'record.export'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
