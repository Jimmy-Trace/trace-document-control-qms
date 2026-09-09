import { describe, expect, it } from "vitest";
import { approvedIntegrationScopes, IntegrationClientError, requireIntegrationScope } from "./integration-clients";

describe("integration client scope boundary", () => {
  it("keeps the initial external scope allow-list intentionally narrow", () => {
    expect(approvedIntegrationScopes).toEqual(["qms.read"]);
  });

  it("allows an approved scope", () => {
    expect(() => requireIntegrationScope({ integrationClientId: "client", organizationId: "org", scopes: ["qms.read"] }, "qms.read")).not.toThrow();
  });

  it("denies a missing scope", () => {
    expect(() => requireIntegrationScope({ integrationClientId: "client", organizationId: "org", scopes: [] }, "qms.read")).toThrow(IntegrationClientError);
  });
});
