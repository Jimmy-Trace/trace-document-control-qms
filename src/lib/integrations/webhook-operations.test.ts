import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const service = fs.readFileSync(path.join(process.cwd(), "src/lib/integrations/webhook-operations.ts"), "utf8");
const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/integrations/webhooks/deliveries/route.ts"), "utf8");

describe("webhook operational administration contract", () => {
  it("keeps diagnostics tenant scoped, permission gated, and payload free", () => {
    expect(service).toContain('permission: "integration.manage"');
    expect(service).toContain('WHERE d."organizationId"=${organizationId}::uuid');
    expect(service).not.toContain('d.payload,');
    expect(service).not.toContain('d."payloadHash"');
    expect(service).toContain('LIMIT ${bounded}');
  });

  it("only requeues eligible dead-letter deliveries", () => {
    expect(service).toContain("d.status='DEAD_LETTER'");
    expect(service).toContain("s.status='REGISTERED'");
    expect(service).toContain("c.status='ACTIVE'");
    expect(service).toContain('FOR UPDATE OF d');
  });

  it("resets delivery execution state and preserves prior failure evidence in audit metadata", () => {
    expect(service).toContain("SET status='PENDING'");
    expect(service).toContain('"attemptCount"=0');
    expect(service).toContain('"responseStatus"=NULL');
    expect(service).toContain('"lastError"=NULL');
    expect(service).toContain('action: "INTEGRATION_WEBHOOK_DELIVERY_REQUEUED"');
    expect(service).toContain('previousAttemptCount: row.attemptCount');
    expect(service).toContain('previousResponseStatus: row.responseStatus');
    expect(service).toContain('previousLastError: row.lastError');
  });

  it("requires an explicit requeue reason and exposes only the controlled requeue operation", () => {
    expect(service).toContain('Webhook delivery requeue reason is required');
    expect(route).toContain('body.operation !== "requeue"');
    expect(route).toContain('requeueDeadLetterWebhookDelivery');
  });
});
