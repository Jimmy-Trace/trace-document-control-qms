import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const serviceSource = readFileSync(new URL("./ai-provider-credentials.ts", import.meta.url), "utf8");
const gatewaySource = readFileSync(new URL("./ai-execution-gateway.ts", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../../../prisma/migrations/0080_ai_provider_credential_binding/migration.sql", import.meta.url), "utf8");

describe("governed AI provider credential binding contract", () => {
  it("requires ai.manage for administration and ai.assist for use", () => {
    expect(serviceSource).toContain('permission: "ai.manage"');
    expect(serviceSource).toContain('permission: "ai.assist"');
  });

  it("stores only a constrained runtime secret name and version metadata", () => {
    expect(serviceSource).toContain("AI_PROVIDER_CREDENTIAL_");
    expect(migrationSource).toContain("AI_PROVIDER_CREDENTIAL_");
    expect(migrationSource).toContain('"credentialVersion" integer NOT NULL DEFAULT 1');
    expect(serviceSource).not.toContain("apiKey");
    expect(serviceSource).not.toContain("clientSecret");
    expect(serviceSource).not.toContain("process.env");
  });

  it("increments credential version on governed rebinding or rotation", () => {
    expect(serviceSource).toContain('"credentialVersion"="AiProviderCredentialBinding"."credentialVersion" + 1');
    expect(serviceSource).toContain("AI provider credential change reason is required");
  });

  it("requires an active credential binding before request evidence is created", () => {
    const credentialGuard = gatewaySource.indexOf("await requireActiveAiProviderCredentialBinding(");
    const evidenceWrite = gatewaySource.indexOf("await recordAiAssistanceRequest(");
    expect(credentialGuard).toBeGreaterThan(-1);
    expect(evidenceWrite).toBeGreaterThan(credentialGuard);
  });

  it("binds credential metadata into the governed execution plan", () => {
    expect(gatewaySource).toContain("credentialBindingId: credentialBinding.id");
    expect(gatewaySource).toContain("credentialRuntimeSecretName: credentialBinding.runtimeSecretName");
    expect(gatewaySource).toContain("credentialVersion: credentialBinding.credentialVersion");
  });

  it("preserves append-only credential lifecycle evidence", () => {
    expect(migrationSource).toContain('CREATE TABLE "AiProviderCredentialBindingEvent"');
    expect(migrationSource).toContain('CREATE TRIGGER "AiProviderCredentialBindingEvent_append_only"');
    expect(serviceSource).toContain('action: "AI_PROVIDER_CREDENTIAL_BINDING_UPDATED"');
  });

  it("does not resolve credentials or execute a provider", () => {
    expect(serviceSource).not.toContain("fetch(");
    expect(serviceSource).not.toContain("axios");
    expect(serviceSource).not.toContain("Authorization: Bearer");
    expect(gatewaySource).not.toContain("process.env");
  });
});
