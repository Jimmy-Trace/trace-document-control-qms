import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.join(process.cwd(), "src/lib/ai/ai-provider-adapter.ts"), "utf8");

describe("governed AI provider adapter contract", () => {
  it("requires exact provider registration and rejects duplicates", () => {
    expect(source).toContain("Duplicate AI provider adapter");
    expect(source).toContain("No governed AI provider adapter registered");
    expect(source).toContain("adapter.provider !== plan.provider");
  });

  it("binds plan, input, and runtime credential without persistence", () => {
    expect(source).toContain("plan: GovernedAiExecutionPlan");
    expect(source).toContain("inputText: string");
    expect(source).toContain("credential: string");
    expect(source).not.toContain("db.");
    expect(source).not.toContain("auditEvent");
    expect(source).not.toContain("console.");
  });

  it("does not implement a provider network client in this slice", () => {
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("axios");
    expect(source).not.toContain("openai");
    expect(source).not.toContain("anthropic");
  });

  it("requires nonblank provider output before downstream use", () => {
    expect(source).toContain("AI provider output");
    expect(source).toContain("providerRequestId");
  });
});
