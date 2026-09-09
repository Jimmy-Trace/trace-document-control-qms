import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { executeGovernedAiAssistance } from "@/lib/ai/ai-execution-orchestrator";
import { createGovernedAiRuntimeRegistry } from "@/lib/ai/ai-runtime-registry";

const bodySchema = z.object({
  useCase: z.enum(["DOCUMENT_SEARCH", "DRAFTING", "SUMMARIZATION", "CLASSIFICATION", "QUALITY_ANALYTICS"]),
  provider: z.literal("OPENAI"),
  model: z.string().trim().min(1).max(100),
  inputText: z.string().trim().min(1).max(50_000),
  sourceEntityType: z.string().trim().min(1).max(100).optional(),
  sourceEntityId: z.string().uuid().optional(),
  includesSourceContent: z.boolean(),
  sourceContentClass: z.enum(["NON_SENSITIVE", "CONTROLLED_QMS", "PERSONNEL_CONFIDENTIAL", "SECURITY_SECRET"]).optional(),
}).superRefine((value, ctx) => {
  if (Boolean(value.sourceEntityType) !== Boolean(value.sourceEntityId)) {
    ctx.addIssue({ code: "custom", message: "Source type and source ID must be provided together" });
  }
  if (value.includesSourceContent !== Boolean(value.sourceContentClass)) {
    ctx.addIssue({ code: "custom", message: "Source content classification must match source content inclusion" });
  }
});

export async function POST(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const body = bodySchema.parse(await request.json());
    const result = await executeGovernedAiAssistance(context, {
      organizationId: context.organizationId,
      ...body,
    }, createGovernedAiRuntimeRegistry());

    return NextResponse.json({
      data: {
        correlationId: result.plan.correlationId,
        useCase: result.plan.useCase,
        provider: result.plan.provider,
        model: result.plan.model,
        outputText: result.outputText,
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "The AI assistance request is invalid" }, { status: 422 });
    }
    if (error instanceof Error && error.message === "Access denied") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: "AI assistance could not be completed" }, { status: 502 });
  }
}
