import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "prisma/migrations/0075_validation_project_status_webhook_outbox/migration.sql",
  "utf8",
);
const subscriptionSource = readFileSync(
  "src/lib/integrations/webhook-subscriptions.ts",
  "utf8",
);

describe("Prompt 057 validation project status webhook outbox", () => {
  it("publishes governed validation-project status action events", () => {
    expect(migration).toContain('AFTER INSERT ON "ValidationProjectActionEvent"');
    expect(migration).toContain("'validation_project.status:' || NEW.id::text");
    expect(migration).toContain("'validation_project.status'");
  });

  it("keeps the external payload metadata-only", () => {
    expect(migration).toContain("'validationProjectId', NEW.\"validationProjectId\"");
    expect(migration).toContain("'statusChangeId', NEW.id");
    expect(migration).toContain("'fromStatus', NEW.\"fromStatus\"");
    expect(migration).toContain("'toStatus', NEW.\"toStatus\"");
    expect(migration).toContain("'changedAt', NEW.\"createdAt\"");
    expect(migration).not.toContain("NEW.reason");
    expect(migration).not.toContain('NEW."actorUserId"');
    expect(migration).not.toContain("NEW.action");
  });

  it("uses the existing approved event and shared idempotent outbox", () => {
    expect(subscriptionSource).toContain('"validation_project.status"');
    expect(migration).toContain('ON CONFLICT ("organizationId","eventId") DO NOTHING');
  });
});
