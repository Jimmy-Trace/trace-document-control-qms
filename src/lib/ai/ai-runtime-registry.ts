import { createGovernedAiProviderRegistry } from "./ai-provider-adapter";
import { createOpenAiResponsesAdapter } from "./providers/openai-responses-adapter";

export function createGovernedAiRuntimeRegistry() {
  return createGovernedAiProviderRegistry([createOpenAiResponsesAdapter()]);
}
