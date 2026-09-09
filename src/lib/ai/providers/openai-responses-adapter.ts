import type {
  GovernedAiProviderAdapter,
  GovernedAiProviderRequest,
  GovernedAiProviderResponse,
} from "../ai-provider-adapter";

export class OpenAiResponsesAdapterError extends Error {}

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TEXT_LENGTH = 100_000;

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new OpenAiResponsesAdapterError("OpenAI response payload is invalid");
  }

  const response = payload as {
    id?: unknown;
    status?: unknown;
    output?: unknown;
  };

  if (response.status !== "completed") {
    throw new OpenAiResponsesAdapterError("OpenAI response did not complete successfully");
  }
  if (!Array.isArray(response.output)) {
    throw new OpenAiResponsesAdapterError("OpenAI response output is invalid");
  }

  const parts: string[] = [];
  for (const item of response.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const candidate = part as { type?: unknown; text?: unknown };
      if (candidate.type === "output_text" && typeof candidate.text === "string") {
        parts.push(candidate.text);
      }
    }
  }

  const outputText = parts.join("\n").trim();
  if (!outputText) {
    throw new OpenAiResponsesAdapterError("OpenAI response did not contain text output");
  }
  if (outputText.length > MAX_OUTPUT_TEXT_LENGTH) {
    throw new OpenAiResponsesAdapterError("OpenAI response exceeded the governed output limit");
  }

  const providerRequestId = typeof response.id === "string" && response.id.trim()
    ? response.id.trim()
    : undefined;

  return { outputText, providerRequestId };
}

export function createOpenAiResponsesAdapter(options?: {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): GovernedAiProviderAdapter {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60_000) {
    throw new OpenAiResponsesAdapterError("OpenAI adapter timeout is invalid");
  }

  return {
    provider: "OPENAI",
    async execute(request: GovernedAiProviderRequest): Promise<GovernedAiProviderResponse> {
      if (request.plan.provider !== "OPENAI") {
        throw new OpenAiResponsesAdapterError("OpenAI adapter received a non-OpenAI execution plan");
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(OPENAI_RESPONSES_URL, {
          method: "POST",
          headers: {
            authorization: `Bearer ${request.credential}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: request.plan.model,
            input: request.inputText,
            store: false,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new OpenAiResponsesAdapterError(`OpenAI request failed with status ${response.status}`);
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().includes("application/json")) {
          throw new OpenAiResponsesAdapterError("OpenAI response content type is invalid");
        }

        return extractOutputText(await response.json());
      } catch (error) {
        if (error instanceof OpenAiResponsesAdapterError) throw error;
        if (error instanceof Error && error.name === "AbortError") {
          throw new OpenAiResponsesAdapterError("OpenAI request timed out");
        }
        throw new OpenAiResponsesAdapterError("OpenAI request failed");
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
