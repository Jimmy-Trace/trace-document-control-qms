import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { PrismaMembershipStore } from "@/lib/memberships/prisma-store";
import { MembershipService, MembershipValidationError } from "@/lib/memberships/service";

const uuid = z.string().uuid();
const replaceSchema = z.object({
  userId: uuid,
  siteIds: z.array(uuid).max(100),
  departmentIds: z.array(uuid).max(200),
  reason: z.string().trim().min(3).max(4000),
});
const service = new MembershipService(new PrismaMembershipStore());

export async function GET(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    return NextResponse.json({ data: await service.list(context) });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
    return NextResponse.json({ error: "Unable to load organizational memberships" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const input = replaceSchema.parse(await request.json());
    return NextResponse.json({ data: await service.replace(context, input) });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof z.ZodError || error instanceof MembershipValidationError) return NextResponse.json({ error: error instanceof MembershipValidationError ? error.message : "Invalid membership request" }, { status: 422 });
    if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
    return NextResponse.json({ error: "Unable to update organizational memberships" }, { status: 500 });
  }
}
