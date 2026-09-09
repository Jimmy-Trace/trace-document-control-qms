import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./ai-execution-preflight.ts", import.meta.url), "utf8");

describe("governed AI execution preflight contract", () => {
  it("revalidates provider/model and source-content policy at execution time", () => {
    expect(source).toContain("requireApprovedAiProvider");
    expect(source).toContain("requiresSourceContentEgress: plan.sourceContentEgressApproved");
    expect(source).toContain("sourceContentClass: plan.sourceContentClass ?? undefined");
  });

  it("revalidates the active credential binding immediately before execution", () => {
    expect(source).toContain("requireActiveAiProviderCredentialBinding");
    expect(source).toContain("credentialBinding.id !== plan.credentialBindingId");
    expect(source).toContain("credentialBinding.credentialVersion !== plan.credentialVersion");
    expect(source).toContain("credentialBinding.runtimeSecretName !== plan.credentialRuntimeSecretName");
  });

  it("rejects plan drift instead of silently substituting new authorization", () => {
    expect(source).toContain("AI provider approval changed after plan preparation");
    expect(source).toContain("AI provider credential binding changed after plan preparation");
    expect(source).toContain("AI provider credential version changed after plan preparation");
    expect(source).toContain("AI provider runtime secret binding changed after plan preparation");
  });

  it("preserves tenant and assistive-only boundaries", () => {
    expect(source).toContain("plan.organizationId !== context.organizationId");
    expect(source).toContain("assertAiExecutionPlanIsAssistiveOnly(plan)");
  });

  it("does not resolve secrets or execute a provider", () => {
    expect(source).not.toContain("process.env");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("axios");
    expect(source).not.toContain("Authorization: Bearer");
  });
});
