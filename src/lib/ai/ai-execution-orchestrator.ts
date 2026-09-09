import type { AuthorizationContext } from "../security/authorization";
import {
  prepareGovernedAiExecution,
  recordGovernedAiExecutionOutcome,
  type GovernedAiExecutionPlan,
} from "./ai-execution-gateway";
import type { AiAssistanceUseCase } from "./ai-governance";
import type { AiSourceContentClass } from "./ai-policy";
import {
  buildGovernedAiProviderRequest,
  validateGovernedAiProviderResponse,
  type GovernedAiProviderAdapter,
} from "./ai-provider-adapter";
import { resolveGovernedAiCredential } from "./ai-runtime-secret";

export class AiExecutionOrchestratorError extends Error {}

export type GovernedAiProviderRegistry = {
  requireAdapter(plan: GovernedAiExecutionPlan): GovernedAiProviderAdapter;
};

export type GovernedAiExecutionInput = {
  organizationId: string;
  useCase: AiAssistanceUseCase;
  provider: string;
  model: string;
  inputText: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  includesSourceContent: boolean;
  sourceContentClass?: AiSourceContentClass;
};

export async function executeGovernedAiAssistance(
  context: AuthorizationContext,
  input: GovernedAiExecutionInput,
  registry: GovernedAiProviderRegistry,
  secretSource: Record<string, string | undefined> = process.env,
) {
  let plan: GovernedAiExecutionPlan | null = null;

  try {
    plan = await prepareGovernedAiExecution(context, input);

    const resolved = await resolveGovernedAiCredential(context, plan, secretSource);
    const adapter = registry.requireAdapter(plan);
    const request = buildGovernedAiProviderRequest(plan, input.inputText, resolved.credential);
    const response = validateGovernedAiProviderResponse(await adapter.execute(request));

    const evidence = await recordGovernedAiExecutionOutcome(context, {
      plan,
      outcome: "COMPLETED",
      outputText: response.outputText,
    });

    return {
      plan,
      outputText: response.outputText,
      providerRequestId: response.providerRequestId,
      evidence,
    };
  } catch (error) {
    if (plan) {
      try {
        await recordGovernedAiExecutionOutcome(context, { plan, outcome: "FAILED" });
      } catch (evidenceError) {
        throw new AiExecutionOrchestratorError(
          "AI execution failed and terminal failure evidence could not be recorded",
          { cause: new AggregateError([error, evidenceError]) },
        );
      }
    }
    throw error;
  }
}
