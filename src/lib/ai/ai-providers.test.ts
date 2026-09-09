import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const serviceSource = readFileSync(new URL("./ai-providers.ts", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../../../prisma/migrations/0078_ai_provider_allowlist/migration.sql", import.meta.url), "utf8");

describe("governed AI provider allowlist contract", () => {
  it("requires ai.manage for provider administration and ai.assist for use", () => {
    expect(serviceSource).toContain('permission: "ai.manage"');
    expect(serviceSource).toContain('permission: "ai.assist"');
  });

  it("requires an explicit provider profile reason and at least one approved model", () => {
    expect(serviceSource).toContain("AI provider policy change reason");
    expect(serviceSource).toContain("At least one approved AI model is required");
    expect(migrationSource).toContain('cardinality("approvedModels")>0');
  });

  it("requires tenant policy approval before external provider use", () => {
    expect(serviceSource).toContain("requireAiUseCaseEnabled");
    expect(serviceSource).toContain("requiresExternalProvider: true");
    expect(serviceSource).toContain("requiresSourceContentEgress: input.requiresSourceContentEgress");
  });

  it("allows only active profiles and explicitly approved models", () => {
    expect(serviceSource).toContain("AND status='ACTIVE'");
    expect(serviceSource).toContain('AND ${model}=ANY("approvedModels")');
    expect(serviceSource).toContain("AI provider or model is not approved");
  });

  it("requires provider-profile approval for source content egress", () => {
    expect(serviceSource).toContain("!profile.allowSourceContentEgress");
    expect(serviceSource).toContain("AI provider profile does not permit source content egress");
  });

  it("preserves append-only provider policy evidence", () => {
    expect(migrationSource).toContain('CREATE TABLE "AiProviderProfileEvent"');
    expect(migrationSource).toContain('CREATE TRIGGER "AiProviderProfileEvent_append_only"');
    expect(serviceSource).toContain('action: "AI_PROVIDER_PROFILE_UPDATED"');
  });

  it("does not introduce credentials or provider execution", () => {
    expect(serviceSource).not.toContain("apiKey");
    expect(serviceSource).not.toContain("Authorization: Bearer");
    expect(serviceSource).not.toContain("fetch(");
    expect(migrationSource).not.toContain("secret");
  });
});
