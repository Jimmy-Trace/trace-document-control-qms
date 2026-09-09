import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const gatewaySource = readFileSync(new URL("./ai-execution-gateway.ts", import.meta.url), "utf8");

describe("governed AI execution gateway contract", () => {
  it("requires the approved provider/model guard before creating request evidence", () => {
    const providerGuard = gatewaySource.indexOf("await requireApprovedAiProvider(");
    const evidenceWrite = gatewaySource.indexOf("await recordAiAssistanceRequest(");
    expect(providerGuard).toBeGreaterThan(-1);
    expect(evidenceWrite).toBeGreaterThan(providerGuard);
  });

  it("passes source-content egress intent and classification into the provider policy guard", () => {
    expect(gatewaySource).toContain("requiresSourceContentEgress: input.includesSourceContent");
    expect(gatewaySource).toContain("sourceContentClass: input.sourceContentClass");
    expect(gatewaySource).toContain("sourceContentEgressApproved: input.includesSourceContent");
    expect(gatewaySource).toContain("sourceContentClass: input.sourceContentClass ?? null");
  });

  it("requires classification whenever source content is included", () => {
    expect(gatewaySource).toContain("input.includesSourceContent && !input.sourceContentClass");
    expect(gatewaySource).toContain("AI source content classification is required before external egress");
    expect(gatewaySource).toContain("!input.includesSourceContent && input.sourceContentClass");
  });

  it("returns only a governed execution plan and does not call a provider", () => {
    expect(gatewaySource).toContain("GovernedAiExecutionPlan");
    expect(gatewaySource).toContain("providerProfileId: profile.id");
    expect(gatewaySource).not.toContain("fetch(");
    expect(gatewaySource).not.toContain("axios");
    expect(gatewaySource).not.toContain("openai");
    expect(gatewaySource).not.toContain("anthropic");
  });

  it("records terminal outcomes with provider/model provenance from the approved plan", () => {
    expect(gatewaySource).toContain("recordAiAssistanceOutcome");
    expect(gatewaySource).toContain("provider: input.plan.provider");
    expect(gatewaySource).toContain("model: input.plan.model");
  });

  it("rejects cross-tenant plan reuse", () => {
    expect(gatewaySource).toContain("input.plan.organizationId !== context.organizationId");
    expect(gatewaySource).toContain("AI execution plan organization mismatch");
  });

  it("preserves the assistive-only no-mutation authority boundary", () => {
    expect(gatewaySource).toContain("plan.governance.assistiveOnly");
    expect(gatewaySource).toContain("plan.governance.mayMutateRegulatedRecords");
    expect(gatewaySource).toContain("AI execution plan violates assistive-only governance");
  });
});
