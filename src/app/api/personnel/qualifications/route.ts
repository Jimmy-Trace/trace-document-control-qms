import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { PrismaPersonnelQualificationStore } from "@/lib/personnel/qualification-store";
import { PersonnelQualificationService } from "@/lib/personnel/qualifications";
import { PersonnelEligibilityError, PersonnelValidationError } from "@/lib/personnel/personnel";

const service = new PersonnelQualificationService(new PrismaPersonnelQualificationStore());
const createSchema = z.object({
  employeeId: z.string().uuid(),
  qualificationType: z.string().max(160),
  qualificationScope: z.string().max(500).nullish(),
  qualifiedAt: z.string().date(),
  expiresAt: z.string().date().nullish(),
  fileId: z.string().uuid().nullish(),
});

export async function GET(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const employeeId = request.nextUrl.searchParams.get("employeeId") ?? undefined;
    if (employeeId) z.string().uuid().parse(employeeId);
    return NextResponse.json({ data: await service.listQualifications(context, context.organizationId, employeeId) });
  } catch (error) {
    return respond(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const input = createSchema.parse(await request.json());
    return NextResponse.json({ data: await service.createQualification(context, {
      organizationId: context.organizationId,
      employeeId: input.employeeId,
      qualificationType: input.qualificationType,
      qualificationScope: input.qualificationScope ?? null,
      qualifiedAt: new Date(`${input.qualifiedAt}T00:00:00.000Z`),
      expiresAt: input.expiresAt ? new Date(`${input.expiresAt}T00:00:00.000Z`) : null,
      fileId: input.fileId ?? null,
    }) }, { status: 201 });
  } catch (error) {
    return respond(error);
  }
}

function respond(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid personnel qualification request" }, { status: 422 });
  if (error instanceof PersonnelValidationError || error instanceof PersonnelEligibilityError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
  return NextResponse.json({ error: "Personnel qualification operation failed" }, { status: 500 });
}
