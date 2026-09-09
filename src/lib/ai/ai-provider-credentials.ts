import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";

export class AiProviderCredentialError extends Error {}

export type AiProviderCredentialBinding = {
  id: string;
  organizationId: string;
  providerProfileId: string;
  runtimeSecretName: string;
  status: "ACTIVE" | "INACTIVE";
  credentialVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

const runtimeSecretNamePattern = /^AI_PROVIDER_CREDENTIAL_[A-Z0-9_]{1,48}$/;

function normalizeRuntimeSecretName(value: string) {
  const normalized = value.trim();
  if (!runtimeSecretNamePattern.test(normalized)) {
    throw new AiProviderCredentialError("AI provider runtime secret name must use the AI_PROVIDER_CREDENTIAL_ namespace");
  }
  return normalized;
}

function requiredReason(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new AiProviderCredentialError("AI provider credential change reason is required");
  return normalized;
}

export async function listAiProviderCredentialBindings(context: AuthorizationContext, organizationId: string) {
  requireAuthorization(context, { organizationId, permission: "ai.manage" });
  return db.$queryRaw<AiProviderCredentialBinding[]>(Prisma.sql`
    SELECT id,"organizationId","providerProfileId","runtimeSecretName",status,"credentialVersion","createdAt","updatedAt"
    FROM "AiProviderCredentialBinding"
    WHERE "organizationId"=${organizationId}::uuid
    ORDER BY "createdAt",id
  `);
}

export async function upsertAiProviderCredentialBinding(
  context: AuthorizationContext,
  input: {
    organizationId: string;
    providerProfileId: string;
    runtimeSecretName: string;
    status: "ACTIVE" | "INACTIVE";
    reason: string;
  },
) {
  requireAuthorization(context, { organizationId: input.organizationId, permission: "ai.manage" });
  const runtimeSecretName = normalizeRuntimeSecretName(input.runtimeSecretName);
  const reason = requiredReason(input.reason);
  if (input.status !== "ACTIVE" && input.status !== "INACTIVE") {
    throw new AiProviderCredentialError("Unsupported AI provider credential status");
  }

  return db.$transaction(async tx => {
    const profile = (await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM "AiProviderProfile"
      WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.providerProfileId}::uuid
      LIMIT 1
    `))[0];
    if (!profile) throw new AiProviderCredentialError("AI provider profile not found");

    const row = (await tx.$queryRaw<AiProviderCredentialBinding[]>(Prisma.sql`
      INSERT INTO "AiProviderCredentialBinding" (
        "organizationId","providerProfileId","runtimeSecretName",status,"credentialVersion","createdByUserId","updatedByUserId"
      ) VALUES (
        ${input.organizationId}::uuid,${input.providerProfileId}::uuid,${runtimeSecretName},${input.status}::"AiProviderCredentialStatus",1,
        ${context.userId}::uuid,${context.userId}::uuid
      )
      ON CONFLICT ("organizationId","providerProfileId") DO UPDATE SET
        "runtimeSecretName"=EXCLUDED."runtimeSecretName",
        status=EXCLUDED.status,
        "credentialVersion"="AiProviderCredentialBinding"."credentialVersion" + 1,
        "updatedByUserId"=EXCLUDED."updatedByUserId",
        "updatedAt"=CURRENT_TIMESTAMP
      RETURNING id,"organizationId","providerProfileId","runtimeSecretName",status,"credentialVersion","createdAt","updatedAt"
    `))[0];
    if (!row) throw new AiProviderCredentialError("AI provider credential binding could not be updated");

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "AiProviderCredentialBindingEvent" (
        "organizationId","credentialBindingId","providerProfileId","runtimeSecretName",status,"credentialVersion",reason,"actorUserId"
      ) VALUES (
        ${row.organizationId}::uuid,${row.id}::uuid,${row.providerProfileId}::uuid,${row.runtimeSecretName},
        ${row.status}::"AiProviderCredentialStatus",${row.credentialVersion},${reason},${context.userId}::uuid
      )
    `);

    await tx.auditEvent.create({ data: {
      organizationId: row.organizationId,
      actorUserId: context.userId,
      action: "AI_PROVIDER_CREDENTIAL_BINDING_UPDATED",
      entityType: "AiProviderCredentialBinding",
      entityId: row.id,
      reason,
      metadata: {
        providerProfileId: row.providerProfileId,
        runtimeSecretName: row.runtimeSecretName,
        status: row.status,
        credentialVersion: row.credentialVersion,
      },
    }});

    return row;
  });
}

export async function requireActiveAiProviderCredentialBinding(
  context: AuthorizationContext,
  organizationId: string,
  providerProfileId: string,
) {
  requireAuthorization(context, { organizationId, permission: "ai.assist" });
  const row = (await db.$queryRaw<AiProviderCredentialBinding[]>(Prisma.sql`
    SELECT id,"organizationId","providerProfileId","runtimeSecretName",status,"credentialVersion","createdAt","updatedAt"
    FROM "AiProviderCredentialBinding"
    WHERE "organizationId"=${organizationId}::uuid
      AND "providerProfileId"=${providerProfileId}::uuid
      AND status='ACTIVE'
    LIMIT 1
  `))[0];
  if (!row) throw new AiProviderCredentialError("Active AI provider credential binding is required");
  return row;
}
