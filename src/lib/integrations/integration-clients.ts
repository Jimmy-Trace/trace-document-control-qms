import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";

export const approvedIntegrationScopes = ["qms.read"] as const;
export type IntegrationScope = (typeof approvedIntegrationScopes)[number];

export class IntegrationClientError extends Error {}

type IntegrationClientRow = {
  id: string;
  organizationId: string;
  name: string;
  status: "ACTIVE" | "REVOKED";
  secretHash: string;
  scopes: string[];
  createdAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
};

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

function validateScopes(scopes: unknown): IntegrationScope[] {
  if (!Array.isArray(scopes) || scopes.length === 0) throw new IntegrationClientError("At least one integration scope is required");
  const normalized = [...new Set(scopes)];
  if (normalized.some(scope => typeof scope !== "string" || !approvedIntegrationScopes.includes(scope as IntegrationScope))) {
    throw new IntegrationClientError("Unsupported integration scope");
  }
  return normalized as IntegrationScope[];
}

export class IntegrationClientService {
  async list(context: AuthorizationContext, organizationId: string) {
    requireAuthorization(context, { organizationId, permission: "integration.manage" });
    return db.$queryRaw<Array<Omit<IntegrationClientRow, "secretHash">>>(Prisma.sql`
      SELECT id,"organizationId",name,status,scopes,"createdAt","revokedAt","lastUsedAt"
      FROM "IntegrationClient" WHERE "organizationId"=${organizationId}::uuid ORDER BY name
    `);
  }

  async create(context: AuthorizationContext, input: { organizationId: string; name: string; scopes: unknown }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "integration.manage" });
    const name = input.name.trim();
    if (!name) throw new IntegrationClientError("Integration client name is required");
    const scopes = validateScopes(input.scopes);
    const secret = randomBytes(32).toString("base64url");
    const secretHash = hashSecret(secret);
    return db.$transaction(async tx => {
      const row = (await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        INSERT INTO "IntegrationClient" ("organizationId",name,"secretHash",scopes,"createdByUserId")
        VALUES (${input.organizationId}::uuid,${name},${secretHash},${scopes}::text[],${context.userId}::uuid)
        RETURNING id
      `))[0];
      if (!row) throw new IntegrationClientError("Integration client could not be created");
      await tx.auditEvent.create({ data: {
        organizationId: input.organizationId,
        actorUserId: context.userId,
        action: "INTEGRATION_CLIENT_CREATED",
        entityType: "IntegrationClient",
        entityId: row.id,
        metadata: { name, scopes },
      }});
      return { id: row.id, name, scopes, token: `tqms.${row.id}.${secret}` };
    });
  }

  async revoke(context: AuthorizationContext, input: { organizationId: string; integrationClientId: string; reason: string }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "integration.manage" });
    const reason = input.reason.trim();
    if (!reason) throw new IntegrationClientError("Revocation reason is required");
    return db.$transaction(async tx => {
      const row = (await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        UPDATE "IntegrationClient" SET status='REVOKED',"revokedByUserId"=${context.userId}::uuid,"revokedAt"=CURRENT_TIMESTAMP
        WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.integrationClientId}::uuid AND status='ACTIVE'
        RETURNING id
      `))[0];
      if (!row) throw new IntegrationClientError("Active integration client not found");
      await tx.auditEvent.create({ data: {
        organizationId: input.organizationId,
        actorUserId: context.userId,
        action: "INTEGRATION_CLIENT_REVOKED",
        entityType: "IntegrationClient",
        entityId: row.id,
        reason,
      }});
      return { id: row.id };
    });
  }
}

export type ExternalIntegrationContext = {
  integrationClientId: string;
  organizationId: string;
  scopes: IntegrationScope[];
};

export async function authenticateIntegrationBearer(authorizationHeader: string | null): Promise<ExternalIntegrationContext> {
  if (!authorizationHeader?.startsWith("Bearer ")) throw new IntegrationClientError("Integration authentication required");
  const token = authorizationHeader.slice(7).trim();
  const [prefix, id, secret, ...rest] = token.split(".");
  if (prefix !== "tqms" || !id || !secret || rest.length) throw new IntegrationClientError("Invalid integration credential");
  const rows = await db.$queryRaw<IntegrationClientRow[]>(Prisma.sql`
    SELECT id,"organizationId",name,status,"secretHash",scopes,"createdAt","revokedAt","lastUsedAt"
    FROM "IntegrationClient" WHERE id=${id}::uuid
  `).catch(() => [] as IntegrationClientRow[]);
  const client = rows[0];
  if (!client || client.status !== "ACTIVE") throw new IntegrationClientError("Invalid integration credential");
  const supplied = Buffer.from(hashSecret(secret), "hex");
  const expected = Buffer.from(client.secretHash, "hex");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new IntegrationClientError("Invalid integration credential");
  const scopes = validateScopes(client.scopes);
  await db.$executeRaw(Prisma.sql`UPDATE "IntegrationClient" SET "lastUsedAt"=CURRENT_TIMESTAMP WHERE id=${client.id}::uuid`);
  return { integrationClientId: client.id, organizationId: client.organizationId, scopes };
}

export function requireIntegrationScope(context: ExternalIntegrationContext, scope: IntegrationScope) {
  if (!context.scopes.includes(scope)) throw new IntegrationClientError("Integration scope denied");
}
