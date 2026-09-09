import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("AI admin diagnostics route contract", () => {
  const source = readFileSync(join(process.cwd(), "src/app/api/admin/ai/diagnostics/route.ts"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/ai/ai-admin-diagnostics.ts"), "utf8");

  it("binds diagnostics to the authenticated organization and ai.manage permission", () => {
    expect(source).toContain("context.organizationId");
    expect(service).toContain('permission: "ai.manage"');
  });

  it("returns metadata-only credential bindings and bounded execution evidence", () => {
    expect(service).toContain("runtimeSecretName");
    expect(service).toContain("credentialVersion");
    expect(service).toContain("LIMIT 100");
    expect(service).not.toContain("process.env");
    expect(service).not.toContain("credential:");
  });
});
