import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "prisma/migrations/0071_transactional_webhook_outbox/migration.sql",
  "utf8",
);
const deliverySource = readFileSync(
  "src/lib/integrations/webhook-delivery.ts",
  "utf8",
);
const workerSource = readFileSync(
  "src/app/api/internal/integrations/webhooks/deliver/route.ts",
  "utf8",
);

describe("Prompt 057 transactional webhook outbox", () => {
  it("records document-effective intent in the same database transaction", () => {
    expect(migration).toContain('CREATE TABLE "IntegrationWebhookOutbox"');
    expect(migration).toContain('AFTER UPDATE OF status ON "DocumentVersion"');
    expect(migration).toContain("NEW.status = 'EFFECTIVE'");
    expect(migration).toContain("'document.effective:' || NEW.id::text");
    expect(migration).toContain("'document.effective'");
  });

  it("makes durable intent idempotent per tenant and event", () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "IntegrationWebhookOutbox_org_event_uidx" ON "IntegrationWebhookOutbox" ("organizationId","eventId")',
    );
    expect(migration).toContain(
      'ON CONFLICT ("organizationId","eventId") DO NOTHING',
    );
  });

  it("reconciles outbox intent before outbound delivery processing", () => {
    expect(deliverySource).toContain("export async function processWebhookOutboxBatch");
    expect(deliverySource).toContain("await queueWebhookEvent({");
    expect(deliverySource).toContain('SET "publishedAt"=CURRENT_TIMESTAMP');
    expect(workerSource.indexOf("processWebhookOutboxBatch(limit)")).toBeLessThan(
      workerSource.indexOf("processWebhookDeliveryBatch(limit)"),
    );
  });

  it("keeps retryable outbox failures instead of dropping event intent", () => {
    expect(deliverySource).toContain("finishOutboxFailure");
    expect(deliverySource).toContain('"publishedAt" IS NULL');
    expect(deliverySource).toContain('"nextAttemptAt"');
    expect(deliverySource).toContain('"lastError"');
  });
});
