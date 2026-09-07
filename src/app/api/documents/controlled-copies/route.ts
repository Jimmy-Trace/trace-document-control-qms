import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { ControlledCopyConflictError, ControlledCopyService, ControlledCopyValidationError } from "@/lib/documents/controlled-copies";
import { ControlledCopyEligibilityError, PrismaControlledCopyStore } from "@/lib/documents/controlled-copy-store";

const service = new ControlledCopyService(new PrismaControlledCopyStore());
const issueSchema = z.object({
  operation: z.literal("ISSUE"),
  documentVersionId: z.string().uuid(),
  recipientName: z.string().max(200),
  location: z.string().max(300).nullish(),
  purpose: z.string().max(500),
});
const transitionSchema = z.object({
  operation: z.enum(["RECALL", "RETURN", "DESTROY"]),
  copyId: z.string().uuid(),
  reason: z.string().max(1000),
});

export async function GET(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    return NextResponse.json({ data: await service.list(context, context.organizationId) });
  } catch (error) {
    return respond(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const body = await request.json();
    if (body?.operation === "ISSUE") {
      const input = issueSchema.parse(body);
      return NextResponse.json({ data: await service.issue(context, { organizationId: context.organizationId, ...input }) }, { status: 201 });
    }
    const input = transitionSchema.parse(body);
    return NextResponse.json({ data: await service.transition(context, { organizationId: context.organizationId, copyId: input.copyId, action: input.operation, reason: input.reason }) });
  } catch (error) {
    return respond(error);
  }
}

function respond(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid controlled copy request" }, { status: 422 });
  if (error instanceof ControlledCopyValidationError || error instanceof ControlledCopyEligibilityError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof ControlledCopyConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
  return NextResponse.json({ error: "Controlled copy operation failed" }, { status: 500 });
}
