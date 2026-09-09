import type { GovernedAiExecutionPlan } from "./ai-execution-gateway";

export class AiProviderAdapterError extends Error {}

export type GovernedAiProviderRequest = {
  plan: GovernedAiExecutionPlan;
  inputText: string;
  credential: string;
};

export type GovernedAiProviderResponse = {
  outputText: string;
  providerRequestId?: string;
};

export type GovernedAiProviderAdapter = {
  provider: string;
  execute(request: GovernedAiProviderRequest): Promise<GovernedAiProviderResponse>;
};

function requiredText(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new AiProviderAdapterError(`${label} is required`);
  return normalized;
}

export function createGovernedAiProviderRegistry(adapters: GovernedAiProviderAdapter[]) {
  const byProvider = new Map<string, GovernedAiProviderAdapter>();

  for (const adapter of adapters) {
    const provider = requiredText(adapter.provider, "AI provider adapter name");
    if (byProvider.has(provider)) {
      throw new AiProviderAdapterError(`Duplicate AI provider adapter: ${provider}`);
    }
    byProvider.set(provider, { ...adapter, provider });
  }

  return {
    requireAdapter(plan: GovernedAiExecutionPlan) {
      const provider = requiredText(plan.provider, "AI execution plan provider");
      const adapter = byProvider.get(provider);
      if (!adapter) {
        throw new AiProviderAdapterError(`No governed AI provider adapter registered for ${provider}`);
      }
      if (adapter.provider !== plan.provider) {
        throw new AiProviderAdapterError("AI provider adapter does not match execution plan provider");
      }
      return adapter;
    },
  };
}

export function buildGovernedAiProviderRequest(
  plan: GovernedAiExecutionPlan,
  inputText: string,
  credential: string,
): GovernedAiProviderRequest {
  const normalizedInput = requiredText(inputText, "AI provider input");
  const normalizedCredential = requiredText(credential, "AI provider credential");

  return {
    plan,
    inputText: normalizedInput,
    credential: normalizedCredential,
  };
}

export function validateGovernedAiProviderResponse(response: GovernedAiProviderResponse) {
  const outputText = requiredText(response.outputText, "AI provider output");
  const providerRequestId = response.providerRequestId?.trim() || undefined;
  return { outputText, providerRequestId };
}
