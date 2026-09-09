import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "prisma/migrations/0073_inventory_lot_status_webhook_outbox/migration.sql",
  "utf8",
);

describe("Prompt 057 inventory lot status webhook outbox", () => {
  it("publishes from the append-only MaterialLotStatusChange ledger", () => {
    expect(migration).toContain('AFTER INSERT ON "MaterialLotStatusChange"');
    expect(migration).toContain("'inventory.lot.status:' || NEW.id::text");
    expect(migration).toContain("'inventory.lot.status'");
  });

  it("keeps the external payload metadata-only", () => {
    expect(migration).toContain("'materialLotId', NEW.\"materialLotId\"");
    expect(migration).toContain("'materialLotStatusChangeId', NEW.id");
    expect(migration).toContain("'fromStatus', NEW.\"fromStatus\"");
    expect(migration).toContain("'toStatus', NEW.\"toStatus\"");
    expect(migration).toContain("'changedAt', NEW.\"createdAt\"");
    expect(migration).not.toContain("'reason'");
    expect(migration).not.toContain("'actorUserId'");
  });

  it("uses the shared tenant-scoped idempotency contract", () => {
    expect(migration).toContain(
      'ON CONFLICT ("organizationId","eventId") DO NOTHING',
    );
  });
});
