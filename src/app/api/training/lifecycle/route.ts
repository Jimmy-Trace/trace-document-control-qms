import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { PrismaTrainingStore } from "@/lib/training/training-store";
import { TrainingEligibilityError, TrainingService, TrainingValidationError } from "@/lib/training/training";

const service = new TrainingService(new PrismaTrainingStore());
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel"), assignmentId: z.string().uuid(), reason: z.string().max(500) }),
  z.object({ action: z.literal("reassign"), assignmentId: z.string().uuid(), assignedAt: z.string().date(), dueAt: z.string().date().nullish(), reason: z.string().max(500) }),
]);

export async function POST(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const input = schema.parse(await request.json());
    if (input.action === "cancel") {
      return NextResponse.json({ data: await service.cancelAssignment(context, { organizationId: context.organizationId, assignmentId: input.assignmentId, reason: input.reason }) });
    }
    return NextResponse.json({ data: await service.reassignAssignment(context, {
      organizationId: context.organizationId,
      assignmentId: input.assignmentId,
      assignedAt: new Date(`${input.assignedAt}T00:00:00.000Z`),
      dueAt: input.dueAt ? new Date(`${input.dueAt}T00:00:00.000Z`) : null,
      reason: input.reason,
    }) });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid training lifecycle request" }, { status: 422 });
    if (error instanceof TrainingValidationError || error instanceof TrainingEligibilityError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
    return NextResponse.json({ error: "Training lifecycle operation failed" }, { status: 500 });
  }
}
