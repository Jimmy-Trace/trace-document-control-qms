import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";

export const approvedAiAssistanceUseCases = [
  "DOCUMENT_SEARCH",
  "DRAFTING",
  "SUMMARIZATION",
  "CLASSIFICATION",
  "QUALITY_ANALYTICS",
] as const;

export type AiAssistanceUseCase = (typeof approvedAiAssistanceUseCases)[number];
export type AiAssistanceOutcome = "COMPLETED" | "REJECTED" | "FAILED";

export const aiGovernanceBoundary = Object.freeze({
  assistiveOnly: true,
  mayApproveControlledRecords: false,
  mayCreateElectronicSignatures: false,
  mayAlterRegulatedHistory: false,
  mayPerformLifecycleTransitions: false,
  mayBypassRequiredHumanReview: false,
  mayMakeComplianceDeterminations: false,
  mayMutateRegulatedRecords: false,
});

export class AiGovernanceError extends Error {}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function validateAiAssistanceUseCase(value: unknown): AiAssistanceUseCase {
  if (typeof value !== "string" || !approvedAiAssistanceUseCases.includes(value as AiAssistanceUseCase)) {
    throw new AiGovernanceError("Unsupported AI assistance use case");
  }
  return value as AiAssistanceUseCase;
}

function validateSource(sourceEntityType?: string, sourceEntityId?: string) {
  if (Boolean(sourceEntityType) !== Boolean(sourceEntityId)) {
    throw new AiGovernanceError("AI assistance source type and source ID must be provided together");
  }
  const normalizedType = sourceEntityType?.trim();
  if (sourceEntityType && !normalizedType) throw new AiGovernanceError("AI assistance source type is required");
  return { sourceEntityType: normalizedType ?? null, sourceEntityId: sourceEntityId ?? null };
}

export async function recordAiAssistanceRequest(
  context: AuthorizationContext,
  input: {
    organizationId: string;
    useCase: unknown;
    inputText: string;
    sourceEntityType?: string;
    sourceEntityId?: string;
  },
) {
  requireAuthorization(context, { organizationId: input.organizationId, permission: "ai.assist" });
  const useCase = validateAiAssistanceUseCase(input.useCase);
  if (!input.inputText.trim()) throw new AiGovernanceError("AI assistance input is required");
  const source = validateSource(input.sourceEntityType, input.sourceEntityId);
  const correlationId = randomUUID();
  const inputSha256 = sha256(input.inputText);

  await db.$transaction(async tx => {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "AiAssistanceEvent" (
        "organizationId","correlationId","eventType","useCase","sourceEntityType","sourceEntityId","inputSha256","actorUserId"
      ) VALUES (
        ${input.organizationId}::uuid,${correlationId}::uuid,'REQUESTED',${useCase}::"AiAssistanceUseCase",
        ${source.sourceEntityType},${source.sourceEntityId}::uuid,${inputSha256},${context.userId}::uuid
      )
    `);
    await tx.auditEvent.create({ data: {
      organizationId: input.organizationId,
      actorUserId: context.userId,
      action: "AI_ASSISTANCE_REQUESTED",
      entityType: "AiAssistanceEvent",
      entityId: correlationId,
      metadata: { useCase, ...source, inputSha256, assistiveOnly: true },
    }});
  });

  return { correlationId, useCase, inputSha256, governance: aiGovernanceBoundary };
}

export async function recordAiAssistanceOutcome(
  context: AuthorizationContext,
  input: {
    organizationId: string;
    correlationId: string;
    useCase: unknown;
    outcome: AiAssistanceOutcome;
    outputText?: string;
    provider?: string;
    model?: string;
    sourceEntityType?: string;
    sourceEntityId?: string;
  },
) {
  requireAuthorization(context, { organizationId: input.organizationId, permission: "ai.assist" });
  const useCase = validateAiAssistanceUseCase(input.useCase);
  const source = validateSource(input.sourceEntityType, input.sourceEntityId);
  if (input.outcome === "COMPLETED" && !input.outputText?.trim()) throw new AiGovernanceError("Completed AI assistance requires output");
  const outputSha256 = input.outputText ? sha256(input.outputText) : null;
  const provider = input.provider?.trim() || null;
  const model = input.model?.trim() || null;

  await db.$transaction(async tx => {
    const request = (await tx.$queryRaw<Array<{ correlationId: string }>>(Prisma.sql`
      SELECT "correlationId" FROM "AiAssistanceEvent"
      WHERE "organizationId"=${input.organizationId}::uuid
        AND "correlationId"=${input.correlationId}::uuid
        AND "eventType"='REQUESTED'
        AND "useCase"=${useCase}::"AiAssistanceUseCase"
      LIMIT 1
    `))[0];
    if (!request) throw new AiGovernanceError("AI assistance request not found");

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "AiAssistanceEvent" (
        "organizationId","correlationId","eventType","useCase","sourceEntityType","sourceEntityId","outputSha256","provider","model","actorUserId"
      ) VALUES (
        ${input.organizationId}::uuid,${input.correlationId}::uuid,${input.outcome}::"AiAssistanceEventType",${useCase}::"AiAssistanceUseCase",
        ${source.sourceEntityType},${source.sourceEntityId}::uuid,${outputSha256},${provider},${model},${context.userId}::uuid
      )
    `);
    await tx.auditEvent.create({ data: {
      organizationId: input.organizationId,
      actorUserId: context.userId,
      action: `AI_ASSISTANCE_${input.outcome}`,
      entityType: "AiAssistanceEvent",
      entityId: input.correlationId,
      metadata: { useCase, ...source, outputSha256, provider, model, assistiveOnly: true },
    }});
  });

  return { correlationId: input.correlationId, useCase, outcome: input.outcome, outputSha256, governance: aiGovernanceBoundary };
}
