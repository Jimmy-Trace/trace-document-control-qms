import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const policySource = readFileSync(new URL("./ai-policy.ts", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../../../prisma/migrations/0077_ai_tenant_policy/migration.sql", import.meta.url), "utf8");
const classificationMigrationSource = readFileSync(new URL("../../../prisma/migrations/0079_ai_source_content_classification/migration.sql", import.meta.url), "utf8");

describe("tenant AI policy governance contract", () => {
  it("requires ai.manage for policy administration and ai.assist for use", () => {
    expect(policySource).toContain('permission: "ai.manage"');
    expect(policySource).toContain('permission: "ai.assist"');
  });

  it("defaults to disabled and requires explicit use-case enablement", () => {
    expect(policySource).toContain("enabled: false");
    expect(policySource).toContain("enabledUseCases: []");
    expect(policySource).toContain("AI assistance use case is not enabled");
  });

  it("keeps external provider and source-content egress independently governed", () => {
    expect(policySource).toContain("External AI provider use is not enabled");
    expect(policySource).toContain("Source content egress is not enabled");
    expect(policySource).toContain("Source content egress requires an approved external provider");
    expect(migrationSource).toContain('NOT "allowSourceContentEgress" OR "allowExternalProvider"');
  });

  it("defaults classified source-content egress to deny and requires an explicit class allow-list", () => {
    expect(classificationMigrationSource).toContain('DEFAULT ARRAY[]::"AiSourceContentClass"[]');
    expect(policySource).toContain("allowedSourceContentClasses: []");
    expect(policySource).toContain("Source content classification is required for external AI egress");
    expect(policySource).toContain("AI source content class is not approved for external egress");
  });

  it("never permits security-secret content for external AI egress", () => {
    expect(policySource).toContain('unique.includes("SECURITY_SECRET")');
    expect(policySource).toContain("Security-secret content cannot be approved for external AI egress");
    expect(policySource).toContain('options.sourceContentClass === "SECURITY_SECRET"');
  });

  it("requires a reason and records append-only policy evidence", () => {
    expect(policySource).toContain("AI policy change reason is required");
    expect(policySource).toContain('action: "AI_TENANT_POLICY_UPDATED"');
    expect(migrationSource).toContain("AI tenant policy evidence is append-only");
    expect(policySource).toContain("allowedSourceContentClasses,");
  });

  it("keeps the policy update and returned state inside one transaction", () => {
    expect(policySource).toContain("return db.$transaction(async tx =>");
    expect(policySource).toContain('RETURNING "organizationId",enabled,"enabledUseCases","allowExternalProvider","allowSourceContentEgress",');
    expect(policySource).toContain('"allowedSourceContentClasses","updatedAt"');
    expect(policySource).toContain("return policy;");
  });
});
