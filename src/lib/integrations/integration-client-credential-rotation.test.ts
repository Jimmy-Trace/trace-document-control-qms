import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const serviceSource = readFileSync("src/lib/integrations/integration-clients.ts", "utf8");
const routeSource = readFileSync("src/app/api/integrations/clients/route.ts", "utf8");

describe("Prompt 057 integration client credential rotation", () => {
  it("keeps administrative listing credential-material free", () => {
    expect(serviceSource).toContain('SELECT id,"organizationId",name,status,scopes,"createdAt","revokedAt","lastUsedAt"');
    expect(serviceSource).not.toContain('SELECT id,"organizationId",name,status,"secretHash",scopes,"createdAt","revokedAt","lastUsedAt"\n      FROM "IntegrationClient" WHERE "organizationId"');
  });

  it("rotates only active tenant-scoped clients and invalidates the previous credential atomically", () => {
    expect(serviceSource).toContain("async rotateCredential");
    expect(serviceSource).toContain("FOR UPDATE");
    expect(serviceSource).toContain("AND status='ACTIVE'");
    expect(serviceSource).toContain('SET "secretHash"=${secretHash},"lastUsedAt"=NULL');
    expect(serviceSource).toContain('action: "INTEGRATION_CLIENT_CREDENTIAL_ROTATED"');
  });

  it("requires an audited reason and returns the new credential only from rotation", () => {
    expect(serviceSource).toContain("Credential rotation reason is required");
    expect(serviceSource).toContain('return { id: row.id, token: `tqms.${row.id}.${secret}` }');
    expect(routeSource).toContain('body.operation === "rotate-credential"');
  });
});
