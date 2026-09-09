import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./ai-runtime-secret.ts", import.meta.url), "utf8");

describe("governed AI runtime secret resolution contract", () => {
  it("requires just-in-time execution preflight before secret lookup", () => {
    const preflight = source.indexOf("await revalidateGovernedAiExecutionPlan(");
    const secretLookup = source.indexOf("source[secretName]");
    expect(preflight).toBeGreaterThan(-1);
    expect(secretLookup).toBeGreaterThan(preflight);
  });

  it("resolves only the plan-bound AI provider secret namespace", () => {
    expect(source).toContain("AI_PROVIDER_CREDENTIAL_");
    expect(source).toContain("secretName !== plan.credentialRuntimeSecretName");
    expect(source).toContain("source[secretName]");
  });

  it("fails closed when the runtime credential is missing", () => {
    expect(source).toContain("AI provider runtime credential is not configured");
  });

  it("does not persist, log, audit, or transmit the credential", () => {
    expect(source).not.toContain("db.");
    expect(source).not.toContain("auditEvent");
    expect(source).not.toContain("console.");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("axios");
  });

  it("does not introduce provider-specific execution code", () => {
    expect(source).not.toContain("openai");
    expect(source).not.toContain("anthropic");
    expect(source).not.toContain("Authorization: Bearer");
  });
});
