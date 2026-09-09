import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";
import { approvedAiAssistanceUseCases, type AiAssistanceUseCase } from "./ai-governance";

export class AiPolicyError extends Error {}

export const aiSourceContentClasses = [
  "NON_SENSITIVE",
  "CONTROLLED_QMS",
  "PERSONNEL_CONFIDENTIAL",
  "SECURITY_SECRET",
] as const;

export type AiSourceContentClass = (typeof aiSourceContentClasses)[number];

function normalizeUseCases(values: unknown): AiAssistanceUseCase[] {
  if (!Array.isArray(values)) throw new AiPolicyError("AI enabled use cases must be an array");
  const unique = [...new Set(values)];
  if (unique.some(value => typeof value !== "string" || !approvedAiAssistanceUseCases.includes(value as AiAssistanceUseCase))) {
    throw new AiPolicyError("Unsupported AI assistance use case");
  }
  return unique as AiAssistanceUseCase[];
}

function normalizeSourceContentClasses(values: unknown): AiSourceContentClass[] {
  if (!Array.isArray(values)) throw new AiPolicyError("AI allowed source content classes must be an array");
  const unique = [...new Set(values)];
  if (unique.some(value => typeof value !== "string" || !aiSourceContentClasses.includes(value as AiSourceContentClass))) {
    throw new AiPolicyError("Unsupported AI source content class");
  }
  if (unique.includes("SECURITY_SECRET")) {
    throw new AiPolicyError("Security-secret content cannot be approved for external AI egress");
  }
  return unique as AiSourceContentClass[];
}

export async function getAiTenantPolicy(context: AuthorizationContext, organizationId: string) {
  requireAuthorization(context, { organizationId, permission: "ai.manage" });
  const rows = await db.$queryRaw<Array<{
    organizationId: string;
    enabled: boolean;
    enabledUseCases: AiAssistanceUseCase[];
    allowExternalProvider: boolean;
    allowSourceContentEgress: boolean;
    allowedSourceContentClasses: AiSourceContentClass[];
    updatedAt: Date;
  }>>(Prisma.sql`
    SELECT "organizationId",enabled,"enabledUseCases","allowExternalProvider","allowSourceContentEgress",
      "allowedSourceContentClasses","updatedAt"
    FROM "AiTenantPolicy" WHERE "organizationId"=${organizationId}::uuid
  `);
  return rows[0] ?? {
    organizationId,
    enabled: false,
    enabledUseCases: [],
    allowExternalProvider: false,
    allowSourceContentEgress: false,
    allowedSourceContentClasses: [],
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
    allowedSourceContentClasses: unknown;
    reason: string;
  },
) {
  requireAuthorization(context, { organizationId: input.organizationId, permission: "ai.manage" });
  const reason = input.reason.trim();
  if (!reason) throw new AiPolicyError("AI policy change reason is required");
  const enabledUseCases = normalizeUseCases(input.enabledUseCases);
  const allowedSourceContentClasses = normalizeSourceContentClasses(input.allowedSourceContentClasses);
  if (!input.enabled && enabledUseCases.length) throw new AiPolicyError("Disabled AI policy cannot enable use cases");
  if (input.allowSourceContentEgress && !input.allowExternalProvider) {
    throw new AiPolicyError("Source content egress requires an approved external provider");
  }
  if (allowedSourceContentClasses.length && !input.allowSourceContentEgress) {
    throw new AiPolicyError("Allowed source content classes require source content egress to be enabled");
  }

  return db.$transaction(async tx => {
    const rows = await tx.$queryRaw<Array<{
      organizationId: string;
      enabled: boolean;
      enabledUseCases: AiAssistanceUseCase[];
      allowExternalProvider: boolean;
      allowSourceContentEgress: boolean;
      allowedSourceContentClasses: AiSourceContentClass[];
      updatedAt: Date;
    }>>(Prisma.sql`
      INSERT INTO "AiTenantPolicy" (
        "organizationId",enabled,"enabledUseCases","allowExternalProvider","allowSourceContentEgress",
        "allowedSourceContentClasses","updatedByUserId","updatedAt"
      ) VALUES (
        ${input.organizationId}::uuid,${input.enabled},${enabledUseCases}::"AiAssistanceUseCase"[],
        ${input.allowExternalProvider},${input.allowSourceContentEgress},
        ${allowedSourceContentClasses}::"AiSourceContentClass"[],${context.userId}::uuid,CURRENT_TIMESTAMP
      )
      ON CONFLICT ("organizationId") DO UPDATE SET
        enabled=EXCLUDED.enabled,
        "enabledUseCases"=EXCLUDED."enabledUseCases",
        "allowExternalProvider"=EXCLUDED."allowExternalProvider",
        "allowSourceContentEgress"=EXCLUDED."allowSourceContentEgress",
        "allowedSourceContentClasses"=EXCLUDED."allowedSourceContentClasses",
        "updatedByUserId"=EXCLUDED."updatedByUserId",
        "updatedAt"=CURRENT_TIMESTAMP
      RETURNING "organizationId",enabled,"enabledUseCases","allowExternalProvider","allowSourceContentEgress",
        "allowedSourceContentClasses","updatedAt"
    `);
    const policy = rows[0];
    if (!policy) throw new AiPolicyError("AI tenant policy could not be updated");

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "AiTenantPolicyEvent" (
        "organizationId",enabled,"enabledUseCases","allowExternalProvider","allowSourceContentEgress",
        "allowedSourceContentClasses",reason,"actorUserId"
      ) VALUES (
        ${input.organizationId}::uuid,${input.enabled},${enabledUseCases}::"AiAssistanceUseCase"[],
        ${input.allowExternalProvider},${input.allowSourceContentEgress},
        ${allowedSourceContentClasses}::"AiSourceContentClass"[],${reason},${context.userId}::uuid
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
        allowedSourceContentClasses,
      },
    }});

    return policy;
  });
}

export async function requireAiUseCaseEnabled(
  context: AuthorizationContext,
  organizationId: string,
  useCase: AiAssistanceUseCase,
  options: {
    requiresExternalProvider?: boolean;
    requiresSourceContentEgress?: boolean;
    sourceContentClass?: AiSourceContentClass;
  } = {},
) {
  requireAuthorization(context, { organizationId, permission: "ai.assist" });
  const rows = await db.$queryRaw<Array<{
    enabled: boolean;
    enabledUseCases: AiAssistanceUseCase[];
    allowExternalProvider: boolean;
    allowSourceContentEgress: boolean;
    allowedSourceContentClasses: AiSourceContentClass[];
  }>>(Prisma.sql`
    SELECT enabled,"enabledUseCases","allowExternalProvider","allowSourceContentEgress","allowedSourceContentClasses"
    FROM "AiTenantPolicy" WHERE "organizationId"=${organizationId}::uuid
  `);
  const policy = rows[0];
  if (!policy?.enabled || !policy.enabledUseCases.includes(useCase)) throw new AiPolicyError("AI assistance use case is not enabled");
  if (options.requiresExternalProvider && !policy.allowExternalProvider) throw new AiPolicyError("External AI provider use is not enabled");
  if (options.requiresSourceContentEgress && !policy.allowSourceContentEgress) throw new AiPolicyError("Source content egress is not enabled");
  if (options.requiresSourceContentEgress && !options.sourceContentClass) {
    throw new AiPolicyError("Source content classification is required for external AI egress");
  }
  if (options.sourceContentClass === "SECURITY_SECRET") {
    throw new AiPolicyError("Security-secret content cannot be sent to an external AI provider");
  }
  if (options.requiresSourceContentEgress && options.sourceContentClass && !policy.allowedSourceContentClasses.includes(options.sourceContentClass)) {
    throw new AiPolicyError("AI source content class is not approved for external egress");
  }
}
