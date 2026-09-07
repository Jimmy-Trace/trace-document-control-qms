import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { PrismaOrganizationalAudienceStore } from "@/lib/acknowledgments/organizational-audience-store";
import { OrganizationalAudienceDistributionService, OrganizationalAudienceValidationError } from "@/lib/acknowledgments/organizational-audience";

const uuid = z.string().uuid();
const service = new OrganizationalAudienceDistributionService(new PrismaOrganizationalAudienceStore());
const assignSchema = z.object({ audienceType: z.enum(["SITE", "DEPARTMENT"]), audienceId: uuid, versionId: uuid, dueAt: z.coerce.date() });

export async function GET(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const data = await service.listOptions(context, context.organizationId);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
    return NextResponse.json({ error: "Unable to load organizational acknowledgment audiences" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const input = assignSchema.parse(await request.json());
    const data = await service.assign(context, { organizationId: context.organizationId, ...input });
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof z.ZodError || error instanceof OrganizationalAudienceValidationError) return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid audience request" }, { status: 422 });
    if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
    return NextResponse.json({ error: "Unable to assign organizational acknowledgment audience" }, { status: 500 });
  }
}
