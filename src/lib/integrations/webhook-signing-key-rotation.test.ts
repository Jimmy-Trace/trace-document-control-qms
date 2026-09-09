import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const subscriptionsSource = readFileSync(new URL("./webhook-subscriptions.ts", import.meta.url), "utf8");
const routeSource = readFileSync(new URL("../../app/api/integrations/webhooks/route.ts", import.meta.url), "utf8");

describe("webhook signing key rotation contract", () => {
  it("requires integration.manage authorization and an explicit reason", () => {
    expect(subscriptionsSource).toContain('permission:"integration.manage"');
    expect(subscriptionsSource).toContain("Webhook signing key rotation reason is required");
  });

  it("rotates only registered tenant subscriptions attached to active clients", () => {
    expect(subscriptionsSource).toContain("s.status='REGISTERED'");
    expect(subscriptionsSource).toContain("c.status='ACTIVE'");
    expect(subscriptionsSource).toContain('s."organizationId"=${input.organizationId}::uuid');
  });

  it("increments the signing key version atomically and derives the replacement secret", () => {
    expect(subscriptionsSource).toContain('SET "signingKeyVersion"="signingKeyVersion"+1');
    expect(subscriptionsSource).toContain("deriveWebhookSigningSecret(row.id,row.signingKeyVersion)");
    expect(subscriptionsSource).toContain("return {id:row.id,signingKeyVersion:row.signingKeyVersion,signingSecret}");
  });

  it("records append-only audit evidence without storing signing secret material", () => {
    expect(subscriptionsSource).toContain('action:"INTEGRATION_WEBHOOK_SIGNING_KEY_ROTATED"');
    expect(subscriptionsSource).toContain("metadata:{signingKeyVersion:row.signingKeyVersion}");
    expect(subscriptionsSource).not.toContain("metadata:{signingSecret");
  });

  it("exposes the governed rotate operation through the existing subscription API", () => {
    expect(routeSource).toContain('body.operation === "rotate_signing_key"');
    expect(routeSource).toContain("service.rotateSigningKey");
  });
});
