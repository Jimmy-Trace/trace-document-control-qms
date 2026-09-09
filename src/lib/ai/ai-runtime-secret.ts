import type { AuthorizationContext } from "../security/authorization";
import type { GovernedAiExecutionPlan } from "./ai-execution-gateway";
import { revalidateGovernedAiExecutionPlan } from "./ai-execution-preflight";

export class AiRuntimeSecretError extends Error {}

const runtimeSecretNamePattern = /^AI_PROVIDER_CREDENTIAL_[A-Z0-9_]{1,48}$/;

export type ResolvedGovernedAiCredential = {
  plan: GovernedAiExecutionPlan;
  credential: string;
};

export async function resolveGovernedAiCredential(
  context: AuthorizationContext,
  plan: GovernedAiExecutionPlan,
  source: Record<string, string | undefined> = process.env,
): Promise<ResolvedGovernedAiCredential> {
  const preflight = await revalidateGovernedAiExecutionPlan(context, plan);
  const secretName = preflight.credentialBinding.runtimeSecretName;

  if (!runtimeSecretNamePattern.test(secretName)) {
    throw new AiRuntimeSecretError("AI provider runtime secret name is invalid");
  }
  if (secretName !== plan.credentialRuntimeSecretName) {
    throw new AiRuntimeSecretError("AI provider runtime secret binding changed after preflight");
  }

  const credential = source[secretName]?.trim();
  if (!credential) {
    throw new AiRuntimeSecretError("AI provider runtime credential is not configured");
  }

  return { plan, credential };
}
