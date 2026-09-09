import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";
import { approvedAiAssistanceUseCases, type AiAssistanceUseCase } from "./ai-governance";

export class AiPolicyError extends Error {}

function normalizeUseCases(values: unknown): AiAssistanceUseCase[] {
  if (!Array.isArray(values)) throw new AiPolicyError("AI enabled use cases must be an array");
  const unique = [...new Set(values)];
  if (unique.some(value => typeof value !== "string" || !approvedAiAssistanceUseCases.includes(value as AiAssistanceUseCase))) {
    throw new AiPolicyError("Unsupported AI assistance use case");
  }
  return unique as AiAssistanceUseCase[];
}

export async function getAiTenantPolicy(context: AuthorizationContext, organizationId: string) {
  requireAuthorization(context, { organizationId, permission: "ai.manage" });
  const rows = await db.$queryRaw<Array<{
    organizationId: string;
    enabled: boolean;
    enabledUseCases: AiAssistanceUseCase[];
    allowExternalProvider: boolean;
    allowSourceContentEgress: boolean;
    updatedAt: Date;
  }>>(Prisma.sql`
    SELECT "organizationId",enabled,"enabledUseCases","allowExternalProvider","allowSourceContentEgress","updatedAt"
    FROM "AiTenantPolicy" WHERE "organizationId"=${organizationId}::uuid
  `);
  return rows[0] ?? {
    organizationId,
    enabled: false,
    enabledUseCases: [],
    allowExternalProvider: false,
    allowSourceContentEgress: false,
    updatedAt: null,
  };
}

export async function updateAiTenantPolicy(
  context: AuthorizationContext,
  input: {
    organizationId: string;
    enabled: boolean;
    enabledUseCases: unknown;
    allowExternalProvider: boolean;
    allowSourceContentEgress: boolean;
    reason: string;
  },
) {
  requireAuthorization(context, { organizationId: input.organizationId, permission: "ai.manage" });
  const reason = input.reason.trim();
  if (!reason) throw new AiPolicyError("AI policy change reason is required");
  const enabledUseCases = normalizeUseCases(input.enabledUseCases);
  if (!input.enabled && enabledUseCases.length) throw new AiPolicyError("Disabled AI policy cannot enable use cases");
  if (input.allowSourceContentEgress && !input.allowExternalProvider) {
    throw new AiPolicyError("Source content egress requires an approved external provider");
  }

  return db.$transaction(async tx => {
    const rows = await tx.$queryRaw<Array<{
      organizationId: string;
      enabled: boolean;
      enabledUseCases: AiAssistanceUseCase[];
      allowExternalProvider: boolean;
      allowSourceContentEgress: boolean;
      updatedAt: Date;
    }>>(Prisma.sql`
      INSERT INTO "AiTenantPolicy" (
        "organizationId",enabled,"enabledUseCases","allowExternalProvider","allowSourceContentEgress","updatedByUserId","updatedAt"
      ) VALUES (
        ${input.organizationId}::uuid,${input.enabled},${enabledUseCases}::"AiAssistanceUseCase"[],
        ${input.allowExternalProvider},${input.allowSourceContentEgress},${context.userId}::uuid,CURRENT_TIMESTAMP
      )
      ON CONFLICT ("organizationId") DO UPDATE SET
        enabled=EXCLUDED.enabled,
        "enabledUseCases"=EXCLUDED."enabledUseCases",
        "allowExternalProvider"=EXCLUDED."allowExternalProvider",
        "allowSourceContentEgress"=EXCLUDED."allowSourceContentEgress",
        "updatedByUserId"=EXCLUDED."updatedByUserId",
        "updatedAt"=CURRENT_TIMESTAMP
      RETURNING "organizationId",enabled,"enabledUseCases","allowExternalProvider","allowSourceContentEgress","updatedAt"
    `);
    const policy = rows[0];
    if (!policy) throw new AiPolicyError("AI tenant policy could not be updated");

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "AiTenantPolicyEvent" (
        "organizationId",enabled,"enabledUseCases","allowExternalProvider","allowSourceContentEgress",reason,"actorUserId"
      ) VALUES (
        ${input.organizationId}::uuid,${input.enabled},${enabledUseCases}::"AiAssistanceUseCase"[],
        ${input.allowExternalProvider},${input.allowSourceContentEgress},${reason},${context.userId}::uuid
      )
    `);

    await tx.auditEvent.create({ data: {
      organizationId: input.organizationId,
      actorUserId: context.userId,
      action: "AI_TENANT_POLICY_UPDATED",
      entityType: "AiTenantPolicy",
      entityId: input.organizationId,
      reason,
      metadata: {
        enabled: input.enabled,
        enabledUseCases,
        allowExternalProvider: input.allowExternalProvider,
        allowSourceContentEgress: input.allowSourceContentEgress,
      },
    }});

    return policy;
  });
}

export async function requireAiUseCaseEnabled(
  context: AuthorizationContext,
  organizationId: string,
  useCase: AiAssistanceUseCase,
  options: { requiresExternalProvider?: boolean; requiresSourceContentEgress?: boolean } = {},
) {
  requireAuthorization(context, { organizationId, permission: "ai.assist" });
  const rows = await db.$queryRaw<Array<{
    enabled: boolean;
    enabledUseCases: AiAssistanceUseCase[];
    allowExternalProvider: boolean;
    allowSourceContentEgress: boolean;
  }>>(Prisma.sql`
    SELECT enabled,"enabledUseCases","allowExternalProvider","allowSourceContentEgress"
    FROM "AiTenantPolicy" WHERE "organizationId"=${organizationId}::uuid
  `);
  const policy = rows[0];
  if (!policy?.enabled || !policy.enabledUseCases.includes(useCase)) throw new AiPolicyError("AI assistance use case is not enabled");
  if (options.requiresExternalProvider && !policy.allowExternalProvider) throw new AiPolicyError("External AI provider use is not enabled");
  if (options.requiresSourceContentEgress && !policy.allowSourceContentEgress) throw new AiPolicyError("Source content egress is not enabled");
}