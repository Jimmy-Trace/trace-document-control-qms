import { describe, expect, it } from "vitest";
import { evaluateAuthorization, type AuthorizationContext } from "../security/authorization";

const context: AuthorizationContext = {
  userId: "22222222-2222-4222-8222-222222222222",
  organizationId: "11111111-1111-4111-8111-111111111111",
  userState: "ACTIVE",
  grants: [{ permission: "document.export", scopeType: "ORGANIZATION", scopeId: null }],
};

describe("controlled document export authorization", () => {
  it("requires the dedicated document.export boundary for same-tenant controlled export", () => {
    expect(evaluateAuthorization(context, { organizationId: context.organizationId, permission: "document.export" })).toEqual({ allowed: true });
  });

  it("rejects cross-tenant export", () => {
    expect(evaluateAuthorization(context, { organizationId: "33333333-3333-4333-8333-333333333333", permission: "document.export" }).allowed).toBe(false);
  });

  it("does not allow document.read alone to export", () => {
    const readOnly: AuthorizationContext = { ...context, grants: [{ permission: "document.read", scopeType: "ORGANIZATION", scopeId: null }] };
    expect(evaluateAuthorization(readOnly, { organizationId: context.organizationId, permission: "document.export" }).allowed).toBe(false);
  });
});
