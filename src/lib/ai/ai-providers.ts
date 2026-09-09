import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";
import type { AiAssistanceUseCase } from "./ai-governance";
import { requireAiUseCaseEnabled } from "./ai-policy";

export class AiProviderError extends Error {}

type AiProviderProfileRow = {
  id: string;
  organizationId: string;
  code: string;
  provider: string;
  status: "ACTIVE" | "INACTIVE";
  approvedModels: string[];
  allowSourceContentEgress: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeRequiredText(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new AiProviderError(`${label} is required`);
  return normalized;
}

function normalizeModels(values: unknown) {
  if (!Array.isArray(values) || values.length === 0) throw new AiProviderError("At least one approved AI model is required");
  const normalized = [...new Set(values.map(value => typeof value === "string" ? value.trim() : ""))];
  if (normalized.some(value => !value)) throw new AiProviderError("Approved AI model names must be non-empty strings");
  return normalized;
}

export async function listAiProviderProfiles(context: AuthorizationContext, organizationId: string) {
  requireAuthorization(context, { organizationId, permission: "ai.manage" });
  return db.$queryRaw<AiProviderProfileRow[]>(Prisma.sql`
    SELECT id,"organizationId",code,provider,status,"approvedModels","allowSourceContentEgress","createdAt","updatedAt"
    FROM "AiProviderProfile"
    WHERE "organizationId"=${organizationId}::uuid
    ORDER BY code
  `);
}

export async function upsertAiProviderProfile(
  context: AuthorizationContext,
  input: {
    organizationId: string;
    providerProfileId?: string;
    code: string;
    provider: string;
    status: "ACTIVE" | "INACTIVE";
    approvedModels: unknown;
    allowSourceContentEgress: boolean;
    reason: string;
  },
) {
  requireAuthorization(context, { organizationId: input.organizationId, permission: "ai.manage" });
  const code = normalizeRequiredText(input.code, "AI provider code");
  const provider = normalizeRequiredText(input.provider, "AI provider name");
  const reason = normalizeRequiredText(input.reason, "AI provider policy change reason");
  if (input.status !== "ACTIVE" && input.status !== "INACTIVE") throw new AiProviderError("Unsupported AI provider status");
  const approvedModels = normalizeModels(input.approvedModels);

  return db.$transaction(async tx => {
    let row: AiProviderProfileRow | undefined;
    if (input.providerProfileId) {
      row = (await tx.$queryRaw<AiProviderProfileRow[]>(Prisma.sql`
        UPDATE "AiProviderProfile" SET
          code=${code},provider=${provider},status=${input.status}::"AiProviderStatus",
          "approvedModels"=${approvedModels}::text[],"allowSourceContentEgress"=${input.allowSourceContentEgress},
          "updatedByUserId"=${context.userId}::uuid,"updatedAt"=CURRENT_TIMESTAMP
        WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.providerProfileId}::uuid
        RETURNING id,"organizationId",code,provider,status,"approvedModels","allowSourceContentEgress","createdAt","updatedAt"
      `))[0];
      if (!row) throw new AiProviderError("AI provider profile not found");
    } else {
      row = (await tx.$queryRaw<AiProviderProfileRow[]>(Prisma.sql`
        INSERT INTO "AiProviderProfile" (
          "organizationId",code,provider,status,"approvedModels","allowSourceContentEgress","createdByUserId","updatedByUserId"
        ) VALUES (
          ${input.organizationId}::uuid,${code},${provider},${input.status}::"AiProviderStatus",
          ${approvedModels}::text[],${input.allowSourceContentEgress},${context.userId}::uuid,${context.userId}::uuid
        )
        RETURNING id,"organizationId",code,provider,status,"approvedModels","allowSourceContentEgress","createdAt","updatedAt"
      `))[0];
      if (!row) throw new AiProviderError("AI provider profile could not be created");
    }

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "AiProviderProfileEvent" (
        "organizationId","providerProfileId",code,provider,status,"approvedModels","allowSourceContentEgress",reason,"actorUserId"
      ) VALUES (
        ${input.organizationId}::uuid,${row.id}::uuid,${row.code},${row.provider},${row.status}::"AiProviderStatus",
        ${row.approvedModels}::text[],${row.allowSourceContentEgress},${reason},${context.userId}::uuid
      )
    `);

    await tx.auditEvent.create({ data: {
      organizationId: input.organizationId,
      actorUserId: context.userId,
      action: "AI_PROVIDER_PROFILE_UPDATED",
      entityType: "AiProviderProfile",
      entityId: row.id,
      reason,
      metadata: {
        code: row.code,
        provider: row.provider,
        status: row.status,
        approvedModels: row.approvedModels,
        allowSourceContentEgress: row.allowSourceContentEgress,
      },
    }});

    return row;
  });
}

export async function requireApprovedAiProvider(
  context: AuthorizationContext,
  input: {
    organizationId: string;
    useCase: AiAssistanceUseCase;
    provider: string;
    model: string;
    requiresSourceContentEgress?: boolean;
  },
) {
  requireAuthorization(context, { organizationId: input.organizationId, permission: "ai.assist" });
  const provider = normalizeRequiredText(input.provider, "AI provider name");
  const model = normalizeRequiredText(input.model, "AI model name");
  await requireAiUseCaseEnabled(context, input.organizationId, input.useCase, {
    requiresExternalProvider: true,
    requiresSourceContentEgress: input.requiresSourceContentEgress,
  });

  const profile = (await db.$queryRaw<AiProviderProfileRow[]>(Prisma.sql`
    SELECT id,"organizationId",code,provider,status,"approvedModels","allowSourceContentEgress","createdAt","updatedAt"
    FROM "AiProviderProfile"
    WHERE "organizationId"=${input.organizationId}::uuid
      AND status='ACTIVE'
      AND provider=${provider}
      AND ${model}=ANY("approvedModels")
    ORDER BY code
    LIMIT 1
  `))[0];
  if (!profile) throw new AiProviderError("AI provider or model is not approved");
  if (input.requiresSourceContentEgress && !profile.allowSourceContentEgress) {
    throw new AiProviderError("AI provider profile does not permit source content egress");
  }
  return profile;
}
