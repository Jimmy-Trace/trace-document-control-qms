import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { PrismaTrainingStore } from "@/lib/training/training-store";
import { TrainingEligibilityError, TrainingService, TrainingValidationError } from "@/lib/training/training";

const service = new TrainingService(new PrismaTrainingStore());
const createSchema = z.object({ code: z.string().max(80), title: z.string().max(240), description: z.string().max(2000).nullish() });

export async function GET(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    return NextResponse.json({ data: await service.listCourses(context, context.organizationId) });
  } catch (error) { return respond(error); }
}

export async function POST(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const input = createSchema.parse(await request.json());
    return NextResponse.json({ data: await service.createCourse(context, { organizationId: context.organizationId, ...input }) }, { status: 201 });
  } catch (error) { return respond(error); }
}

function respond(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid training course request" }, { status: 422 });
  if (error instanceof TrainingValidationError || error instanceof TrainingEligibilityError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
  return NextResponse.json({ error: "Training course operation failed" }, { status: 500 });
}
