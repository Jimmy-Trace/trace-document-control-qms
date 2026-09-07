import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { PrismaPersonnelCredentialStore } from "@/lib/personnel/credential-store";
import { PersonnelCredentialService } from "@/lib/personnel/credentials";
import { PersonnelEligibilityError, PersonnelValidationError } from "@/lib/personnel/personnel";

const service = new PersonnelCredentialService(new PrismaPersonnelCredentialStore());
const createSchema = z.object({
  employeeId: z.string().uuid(),
  credentialType: z.string().max(160),
  credentialNumber: z.string().max(160).nullish(),
  issuingAuthority: z.string().max(240).nullish(),
  issuedAt: z.string().date().nullish(),
  expiresAt: z.string().date().nullish(),
  fileId: z.string().uuid().nullish(),
});

export async function GET(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const employeeId = request.nextUrl.searchParams.get("employeeId") ?? undefined;
    if (employeeId) z.string().uuid().parse(employeeId);
    return NextResponse.json({ data: await service.listCredentials(context, context.organizationId, employeeId) });
  } catch (error) {
    return respond(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const input = createSchema.parse(await request.json());
    return NextResponse.json({ data: await service.createCredential(context, {
      organizationId: context.organizationId,
      employeeId: input.employeeId,
      credentialType: input.credentialType,
      credentialNumber: input.credentialNumber ?? null,
      issuingAuthority: input.issuingAuthority ?? null,
      issuedAt: input.issuedAt ? new Date(`${input.issuedAt}T00:00:00.000Z`) : null,
      expiresAt: input.expiresAt ? new Date(`${input.expiresAt}T00:00:00.000Z`) : null,
      fileId: input.fileId ?? null,
    }) }, { status: 201 });
  } catch (error) {
    return respond(error);
  }
}

function respond(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid personnel credential request" }, { status: 422 });
  if (error instanceof PersonnelValidationError || error instanceof PersonnelEligibilityError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
  return NextResponse.json({ error: "Personnel credential operation failed" }, { status: 500 });
}
