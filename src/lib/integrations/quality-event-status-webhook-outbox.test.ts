import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "prisma/migrations/0074_quality_event_status_webhook_outbox/migration.sql",
  "utf8",
);
const subscriptionSource = readFileSync(
  "src/lib/integrations/webhook-subscriptions.ts",
  "utf8",
);

describe("Prompt 057 quality event status webhook outbox", () => {
  it("publishes only governed quality-event status changes", () => {
    expect(migration).toContain('AFTER INSERT ON "QualityEventChange"');
    expect(migration).toContain("NEW.kind = 'STATUS'");
    expect(migration).toContain("'quality_event.status:' || NEW.id::text");
    expect(migration).toContain("'quality_event.status'");
  });

  it("keeps the external payload metadata-only", () => {
    expect(migration).toContain("'qualityEventId', NEW.\"eventId\"");
    expect(migration).toContain("'statusChangeId', NEW.id");
    expect(migration).toContain("'fromStatus', NEW.\"fromValue\"");
    expect(migration).toContain("'toStatus', NEW.\"toValue\"");
    expect(migration).toContain("'changedAt', NEW.\"createdAt\"");
    expect(migration).not.toContain("NEW.reason");
    expect(migration).not.toContain('NEW."actorUserId"');
  });

  it("uses the existing approved event and shared idempotent outbox", () => {
    expect(subscriptionSource).toContain('"quality_event.status"');
    expect(migration).toContain('ON CONFLICT ("organizationId","eventId") DO NOTHING');
  });
});
