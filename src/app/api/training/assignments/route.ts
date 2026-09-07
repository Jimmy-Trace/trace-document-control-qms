import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { PrismaTrainingStore } from "@/lib/training/training-store";
import { TrainingEligibilityError, TrainingService, TrainingValidationError } from "@/lib/training/training";

const service = new TrainingService(new PrismaTrainingStore());
const createSchema = z.object({ employeeId: z.string().uuid(), courseId: z.string().uuid(), assignedAt: z.string().date(), dueAt: z.string().date().nullish() });

export async function GET(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const employeeId = request.nextUrl.searchParams.get("employeeId") ?? undefined;
    if (employeeId) z.string().uuid().parse(employeeId);
    return NextResponse.json({ data: await service.listAssignments(context, context.organizationId, employeeId) });
  } catch (error) { return respond(error); }
}

export async function POST(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const input = createSchema.parse(await request.json());
    return NextResponse.json({ data: await service.createAssignment(context, {
      organizationId: context.organizationId,
      employeeId: input.employeeId,
      courseId: input.courseId,
      assignedAt: new Date(`${input.assignedAt}T00:00:00.000Z`),
      dueAt: input.dueAt ? new Date(`${input.dueAt}T00:00:00.000Z`) : null,
    }) }, { status: 201 });
  } catch (error) { return respond(error); }
}

function respond(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid training assignment request" }, { status: 422 });
  if (error instanceof TrainingValidationError || error instanceof TrainingEligibilityError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
  return NextResponse.json({ error: "Training assignment operation failed" }, { status: 500 });
}
