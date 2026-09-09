import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "prisma/migrations/0072_equipment_status_webhook_outbox/migration.sql",
  "utf8",
);

describe("Prompt 057 equipment status webhook outbox", () => {
  it("publishes from the append-only equipment status change record", () => {
    expect(migration).toContain('AFTER INSERT ON "EquipmentStatusChange"');
    expect(migration).toContain("'equipment.status:' || NEW.id::text");
    expect(migration).toContain("'equipment.status'");
  });

  it("keeps the payload metadata-only and transition-specific", () => {
    expect(migration).toContain("'equipmentId', NEW.\"equipmentId\"");
    expect(migration).toContain("'statusChangeId', NEW.id");
    expect(migration).toContain("'fromStatus', NEW.\"fromStatus\"");
    expect(migration).toContain("'toStatus', NEW.\"toStatus\"");
    expect(migration).toContain("'changedAt', NEW.\"changedAt\"");
    expect(migration).not.toContain("reason");
    expect(migration).not.toContain("actorUserId");
  });

  it("uses tenant/event idempotency already enforced by the shared outbox", () => {
    expect(migration).toContain('ON CONFLICT ("organizationId","eventId") DO NOTHING');
  });
});
