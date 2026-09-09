import type { AuthorizationContext } from "../security/authorization";
import { requireActiveAiProviderCredentialBinding } from "./ai-provider-credentials";
import { requireApprovedAiProvider } from "./ai-providers";
import {
  assertAiExecutionPlanIsAssistiveOnly,
  type GovernedAiExecutionPlan,
} from "./ai-execution-gateway";

export class AiExecutionPreflightError extends Error {}

export async function revalidateGovernedAiExecutionPlan(
  context: AuthorizationContext,
  plan: GovernedAiExecutionPlan,
) {
  if (plan.organizationId !== context.organizationId) {
    throw new AiExecutionPreflightError("AI execution plan organization mismatch");
  }

  assertAiExecutionPlanIsAssistiveOnly(plan);

  const profile = await requireApprovedAiProvider(context, {
    organizationId: plan.organizationId,
    useCase: plan.useCase,
    provider: plan.provider,
    model: plan.model,
    requiresSourceContentEgress: plan.sourceContentEgressApproved,
    sourceContentClass: plan.sourceContentClass ?? undefined,
  });

  if (profile.id !== plan.providerProfileId) {
    throw new AiExecutionPreflightError("AI provider approval changed after plan preparation");
  }

  const credentialBinding = await requireActiveAiProviderCredentialBinding(
    context,
    plan.organizationId,
    profile.id,
  );

  if (credentialBinding.id !== plan.credentialBindingId) {
    throw new AiExecutionPreflightError("AI provider credential binding changed after plan preparation");
  }
  if (credentialBinding.credentialVersion !== plan.credentialVersion) {
    throw new AiExecutionPreflightError("AI provider credential version changed after plan preparation");
  }
  if (credentialBinding.runtimeSecretName !== plan.credentialRuntimeSecretName) {
    throw new AiExecutionPreflightError("AI provider runtime secret binding changed after plan preparation");
  }

  return {
    plan,
    providerProfile: profile,
    credentialBinding,
  };
}
