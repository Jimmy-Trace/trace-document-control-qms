import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const governanceSource = readFileSync(new URL("./ai-governance.ts", import.meta.url), "utf8");
const migrationSource = readFileSync(
  new URL("../../../prisma/migrations/0076_ai_assistance_governance/migration.sql", import.meta.url),
  "utf8",
);

describe("governed AI assistance foundation", () => {
  it("uses a server-owned allow-list limited to approved assistive use cases", () => {
    for (const useCase of ["DOCUMENT_SEARCH", "DRAFTING", "SUMMARIZATION", "CLASSIFICATION", "QUALITY_ANALYTICS"]) {
      expect(governanceSource).toContain(`"${useCase}"`);
      expect(migrationSource).toContain(`'${useCase}'`);
    }
  });

  it("requires least-privilege AI authorization", () => {
    expect(governanceSource).toContain('permission: "ai.assist"');
    expect(migrationSource).toContain("'ai.assist'");
    expect(migrationSource).toContain("'ai.manage'");
  });

  it("hard-codes the regulated authority boundary as deny-only", () => {
    for (const control of [
      "mayApproveControlledRecords: false",
      "mayCreateElectronicSignatures: false",
      "mayAlterRegulatedHistory: false",
      "mayPerformLifecycleTransitions: false",
      "mayBypassRequiredHumanReview: false",
      "mayMakeComplianceDeterminations: false",
      "mayMutateRegulatedRecords: false",
    ]) expect(governanceSource).toContain(control);
  });

  it("stores hashes and provenance rather than prompt or output bodies", () => {
    expect(migrationSource).toContain('"inputSha256" text');
    expect(migrationSource).toContain('"outputSha256" text');
    expect(migrationSource).toContain('"provider" text');
    expect(migrationSource).toContain('"model" text');
    expect(migrationSource).not.toContain('"inputText"');
    expect(migrationSource).not.toContain('"outputText"');
  });

  it("makes AI assistance evidence append-only with one request and one terminal outcome", () => {
    expect(migrationSource).toContain('CREATE TRIGGER "AiAssistanceEvent_append_only"');
    expect(migrationSource).toContain('CREATE UNIQUE INDEX "AiAssistanceEvent_request_uidx"');
    expect(migrationSource).toContain('CREATE UNIQUE INDEX "AiAssistanceEvent_terminal_uidx"');
  });

  it("requires model provenance before a completed outcome can be recorded", () => {
    expect(governanceSource).toContain("Completed AI assistance requires provider and model provenance");
    expect(migrationSource).toContain('"AiAssistanceEvent_completed_shape_check"');
  });
});
