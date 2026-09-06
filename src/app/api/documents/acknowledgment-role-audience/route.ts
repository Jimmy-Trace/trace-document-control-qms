import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { PrismaRoleAudienceStore } from "@/lib/acknowledgments/role-audience-store";
import { RoleAudienceDistributionService, RoleAudienceValidationError } from "@/lib/acknowledgments/role-audience";

const uuid = z.string().uuid();
const service = new RoleAudienceDistributionService(new PrismaRoleAudienceStore());
const assignSchema = z.object({ organizationId: uuid, roleId: uuid, versionId: uuid, dueAt: z.coerce.date() });

export async function GET(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const data = await service.listOptions(context, context.organizationId);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
    return NextResponse.json({ error: "Unable to load acknowledgment audiences" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const input = assignSchema.parse(await request.json());
    const data = await service.assign(context, input);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof z.ZodError || error instanceof RoleAudienceValidationError) return NextResponse.json({ error: "The role audience request is invalid" }, { status: 422 });
    if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
    return NextResponse.json({ error: "Unable to assign acknowledgment audience" }, { status: 500 });
  }
}
