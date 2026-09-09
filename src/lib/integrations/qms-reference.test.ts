import { describe, expect, it } from "vitest";
import { IntegrationClientError } from "./integration-clients";
import { normalizeReferenceLimit } from "./qms-reference";

describe("external QMS reference API boundary", () => {
  it("defaults to a bounded page size", () => {
    expect(normalizeReferenceLimit(null)).toBe(50);
  });

  it("accepts only an integer from 1 through 100", () => {
    expect(normalizeReferenceLimit("1")).toBe(1);
    expect(normalizeReferenceLimit("100")).toBe(100);
    expect(() => normalizeReferenceLimit("0")).toThrow(IntegrationClientError);
    expect(() => normalizeReferenceLimit("101")).toThrow(IntegrationClientError);
    expect(() => normalizeReferenceLimit("1.5")).toThrow(IntegrationClientError);
  });
});
