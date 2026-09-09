import { describe, expect, it } from "vitest";
import { IntegrationClientError, requireIntegrationScope } from "./integration-clients";
import { normalizeReferenceLimit } from "./qms-reference";

describe("external inventory reference boundary", () => {
  it("requires the existing qms.read scope", () => {
    expect(() => requireIntegrationScope({ integrationClientId: "client", organizationId: "org", scopes: ["qms.read"] }, "qms.read")).not.toThrow();
    expect(() => requireIntegrationScope({ integrationClientId: "client", organizationId: "org", scopes: [] }, "qms.read")).toThrow(IntegrationClientError);
  });

  it("uses the shared bounded reference limit", () => {
    expect(normalizeReferenceLimit(null)).toBe(50);
    expect(normalizeReferenceLimit("100")).toBe(100);
    expect(() => normalizeReferenceLimit("101")).toThrow(IntegrationClientError);
  });
});
