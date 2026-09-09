import { describe, expect, it, vi } from "vitest";
import { createOpenAiResponsesAdapter, OpenAiResponsesAdapterError } from "./openai-responses-adapter";

const plan = {
  correlationId: "11111111-1111-1111-1111-111111111111",
  organizationId: "22222222-2222-2222-2222-222222222222",
  useCase: "SUMMARIZATION" as const,
  providerProfileId: "33333333-3333-3333-3333-333333333333",
  credentialBindingId: "44444444-4444-4444-4444-444444444444",
  credentialRuntimeSecretName: "AI_PROVIDER_CREDENTIAL_OPENAI",
  credentialVersion: 1,
  provider: "OPENAI",
  model: "gpt-5.6",
  inputSha256: "a".repeat(64),
  sourceEntityType: null,
  sourceEntityId: null,
  sourceContentEgressApproved: false,
  sourceContentClass: null,
  governance: {
    assistiveOnly: true,
    mayApproveControlledRecords: false,
    mayCreateElectronicSignatures: false,
    mayAlterRegulatedHistory: false,
    mayPerformLifecycleTransitions: false,
    mayBypassRequiredHumanReview: false,
    mayMakeComplianceDeterminations: false,
    mayMutateRegulatedRecords: false,
  },
};

describe("OpenAI Responses adapter", () => {
  it("sends only the governed model/input with store disabled", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        authorization: "Bearer secret-value",
        "content-type": "application/json",
      });
      expect(JSON.parse(String(init?.body))).toEqual({
        model: "gpt-5.6",
        input: "Summarize this",
        store: false,
      });
      return new Response(JSON.stringify({
        id: "resp_123",
        status: "completed",
        output: [{ content: [{ type: "output_text", text: "Summary" }] }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    });

    const adapter = createOpenAiResponsesAdapter({ fetchImpl: fetchImpl as typeof fetch });
    await expect(adapter.execute({ plan, inputText: "Summarize this", credential: "secret-value" }))
      .resolves.toEqual({ outputText: "Summary", providerRequestId: "resp_123" });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("fails closed on provider mismatch and unsuccessful responses", async () => {
    const adapter = createOpenAiResponsesAdapter({
      fetchImpl: vi.fn(async () => new Response("{}", {
        status: 429,
        headers: { "content-type": "application/json" },
      })) as typeof fetch,
    });

    await expect(adapter.execute({
      plan: { ...plan, provider: "OTHER" },
      inputText: "x",
      credential: "secret-value",
    })).rejects.toBeInstanceOf(OpenAiResponsesAdapterError);

    await expect(adapter.execute({ plan, inputText: "x", credential: "secret-value" }))
      .rejects.toThrow("OpenAI request failed with status 429");
  });

  it("rejects incomplete or non-text responses", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      id: "resp_123",
      status: "incomplete",
      output: [],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const adapter = createOpenAiResponsesAdapter({ fetchImpl: fetchImpl as typeof fetch });
    await expect(adapter.execute({ plan, inputText: "x", credential: "secret-value" }))
      .rejects.toThrow("did not complete successfully");
  });
});
