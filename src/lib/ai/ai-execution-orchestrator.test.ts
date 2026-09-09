import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.join(process.cwd(), "src/lib/ai/ai-execution-orchestrator.ts"), "utf8");

describe("governed AI execution orchestrator contract", () => {
  it("prepares governance before resolving credentials or invoking an adapter", () => {
    const prepare = source.indexOf("await prepareGovernedAiExecution");
    const resolve = source.indexOf("await resolveGovernedAiCredential");
    const execute = source.indexOf("await adapter.execute");
    expect(prepare).toBeGreaterThan(-1);
    expect(resolve).toBeGreaterThan(prepare);
    expect(execute).toBeGreaterThan(resolve);
  });

  it("records completed evidence only after response validation", () => {
    const validate = source.indexOf("validateGovernedAiProviderResponse(await adapter.execute(request))");
    const completed = source.indexOf('outcome: "COMPLETED"');
    expect(validate).toBeGreaterThan(-1);
    expect(completed).toBeGreaterThan(validate);
  });

  it("records failed evidence for downstream failures after plan creation", () => {
    expect(source).toContain('recordGovernedAiExecutionOutcome(context, { plan, outcome: "FAILED" })');
    expect(source).toContain("terminal failure evidence could not be recorded");
  });

  it("does not persist, log, or audit credential or body content directly", () => {
    expect(source).not.toMatch(/console\./);
    expect(source).not.toContain("db.");
    expect(source).not.toContain("auditEvent");
    expect(source).not.toContain("fetch(");
  });
});
