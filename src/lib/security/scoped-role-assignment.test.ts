import { describe, expect, it } from "vitest";
import { evaluateAuthorization, type AuthorizationContext } from "./authorization";

function context(scopeType: "ORGANIZATION" | "SITE" | "DEPARTMENT", scopeId: string | null): AuthorizationContext {
  return {
    userId: "user-1",
    organizationId: "org-1",
    userState: "ACTIVE",
    grants: [{ permission: "document.read", scopeType, scopeId }],
  };
}

describe("scoped role authorization", () => {
  it("allows an organization-scoped grant across the tenant", () => {
    expect(evaluateAuthorization(context("ORGANIZATION", null), { organizationId: "org-1", permission: "document.read", siteId: "site-1" }).allowed).toBe(true);
  });

  it("allows a site grant only when the requested site matches", () => {
    const scoped = context("SITE", "site-1");
    expect(evaluateAuthorization(scoped, { organizationId: "org-1", permission: "document.read", siteId: "site-1" }).allowed).toBe(true);
    expect(evaluateAuthorization(scoped, { organizationId: "org-1", permission: "document.read", siteId: "site-2" })).toEqual({ allowed: false, reason: "scope_mismatch" });
    expect(evaluateAuthorization(scoped, { organizationId: "org-1", permission: "document.read" })).toEqual({ allowed: false, reason: "scope_mismatch" });
  });

  it("allows a department grant only when the requested department matches", () => {
    const scoped = context("DEPARTMENT", "department-1");
    expect(evaluateAuthorization(scoped, { organizationId: "org-1", permission: "document.read", departmentId: "department-1" }).allowed).toBe(true);
    expect(evaluateAuthorization(scoped, { organizationId: "org-1", permission: "document.read", departmentId: "department-2" })).toEqual({ allowed: false, reason: "scope_mismatch" });
  });
});
