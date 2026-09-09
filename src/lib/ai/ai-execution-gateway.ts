import type { AuthorizationContext } from "../security/authorization";
import {
  aiGovernanceBoundary,
  recordAiAssistanceOutcome,
  recordAiAssistanceRequest,
  type AiAssistanceOutcome,
  type AiAssistanceUseCase,
} from "./ai-governance";
import { requireApprovedAiProvider } from "./ai-providers";
import type { AiSourceContentClass } from "./ai-policy";

export class AiExecutionGatewayError extends Error {}

export type GovernedAiExecutionPlan = {
  correlationId: string;
  organizationId: string;
  useCase: AiAssistanceUseCase;
  providerProfileId: string;
  provider: string;
  model: string;
  inputSha256: string;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  sourceContentEgressApproved: boolean;
  sourceContentClass: AiSourceContentClass | null;
  governance: typeof aiGovernanceBoundary;
};

function requiredText(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new AiExecutionGatewayError(`${label} is required`);
  return normalized;
}

export async function prepareGovernedAiExecution(
  context: AuthorizationContext,
  input: {
    organizationId: string;
    useCase: AiAssistanceUseCase;
    provider: string;
    model: string;
    inputText: string;
    sourceEntityType?: string;
    sourceEntityId?: string;
    includesSourceContent: boolean;
    sourceContentClass?: AiSourceContentClass;
  },
): Promise<GovernedAiExecutionPlan> {
  const provider = requiredText(input.provider, "AI provider name");
  const model = requiredText(input.model, "AI model name");
  requiredText(input.inputText, "AI assistance input");
  if (input.includesSourceContent && !input.sourceContentClass) {
    throw new AiExecutionGatewayError("AI source content classification is required before external egress");
  }
  if (!input.includesSourceContent && input.sourceContentClass) {
    throw new AiExecutionGatewayError("AI source content classification requires source content");
  }

  const profile = await requireApprovedAiProvider(context, {
    organizationId: input.organizationId,
    useCase: input.useCase,
    provider,
    model,
    requiresSourceContentEgress: input.includesSourceContent,
    sourceContentClass: input.sourceContentClass,
  });

  const request = await recordAiAssistanceRequest(context, {
    organizationId: input.organizationId,
    useCase: input.useCase,
    inputText: input.inputText,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
  });

  return {
    correlationId: request.correlationId,
    organizationId: input.organizationId,
    useCase: request.useCase,
    providerProfileId: profile.id,
    provider,
    model,
    inputSha256: request.inputSha256,
    sourceEntityType: input.sourceEntityType?.trim() || null,
    sourceEntityId: input.sourceEntityId ?? null,
    sourceContentEgressApproved: input.includesSourceContent,
    sourceContentClass: input.sourceContentClass ?? null,
    governance: aiGovernanceBoundary,
  };
}

export async function recordGovernedAiExecutionOutcome(
  context: AuthorizationContext,
  input: {
    plan: GovernedAiExecutionPlan;
    outcome: AiAssistanceOutcome;
    outputText?: string;
  },
) {
  if (input.plan.organizationId !== context.organizationId) {
    throw new AiExecutionGatewayError("AI execution plan organization mismatch");
  }

  return recordAiAssistanceOutcome(context, {
    organizationId: input.plan.organizationId,
    correlationId: input.plan.correlationId,
    useCase: input.plan.useCase,
    outcome: input.outcome,
    outputText: input.outputText,
    provider: input.plan.provider,
    model: input.plan.model,
    sourceEntityType: input.plan.sourceEntityType ?? undefined,
    sourceEntityId: input.plan.sourceEntityId ?? undefined,
  });
}

export function assertAiExecutionPlanIsAssistiveOnly(plan: GovernedAiExecutionPlan) {
  if (!plan.governance.assistiveOnly || plan.governance.mayMutateRegulatedRecords) {
    throw new AiExecutionGatewayError("AI execution plan violates assistive-only governance");
  }
  return plan;
}
