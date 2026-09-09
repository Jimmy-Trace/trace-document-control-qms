import { describe, expect, it } from "vitest";
import { normalizeReferenceLimit } from "./qms-reference";

describe("external quality-event reference boundary", () => {
  it("reuses the bounded external reference limit contract", () => {
    expect(normalizeReferenceLimit(null)).toBe(50);
    expect(normalizeReferenceLimit("100")).toBe(100);
    expect(() => normalizeReferenceLimit("101")).toThrow();
  });

  it("keeps the external quality-event payload metadata-only", () => {
    const allowed = ["qualityEventId", "eventNumber", "type", "severity", "source", "status", "discoveredAt", "dueAt"];
    expect(allowed).not.toContain("summary");
    expect(allowed).not.toContain("description");
    expect(allowed).not.toContain("reportedByUserId");
    expect(allowed).not.toContain("ownerUserId");
  });
});
