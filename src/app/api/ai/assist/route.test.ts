import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(process.cwd(), "src/app/api/ai/assist/route.ts"), "utf8");

describe("governed AI assistance API contract", () => {
  it("binds organization to authenticated context and uses the governed orchestrator", () => {
    expect(source).toContain("organizationId: context.organizationId");
    expect(source).toContain("executeGovernedAiAssistance");
    expect(source).toContain("createGovernedAiRuntimeRegistry");
    expect(source).not.toMatch(/organizationId:\s*z\./);
  });

  it("restricts provider, use cases, input size, and source classification", () => {
    expect(source).toContain('z.literal("OPENAI")');
    for (const useCase of ["DOCUMENT_SEARCH", "DRAFTING", "SUMMARIZATION", "CLASSIFICATION", "QUALITY_ANALYTICS"]) {
      expect(source).toContain(`"${useCase}"`);
    }
    expect(source).toContain("max(50_000)");
    expect(source).toContain('"SECURITY_SECRET"');
    expect(source).toContain("Source content classification must match source content inclusion");
  });

  it("does not expose credentials, provider request IDs, or regulated mutation controls", () => {
    expect(source).not.toContain("credential:");
    expect(source).not.toContain("providerRequestId:");
    expect(source).not.toMatch(/approve|signature|lifecycle transition|mutate regulated/i);
  });
});
